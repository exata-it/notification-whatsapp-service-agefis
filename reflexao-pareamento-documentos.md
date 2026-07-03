# Reflexão — pareamento documento ↔ anexo (à prova de idiotas)

> Notas para decidir depois. Contexto: rota `send-email` / `send-whatsapp`, controller
> `src/controllers/notificacoes/_documentos-fiscais.controller.js`.

## 1. Problema relatado

Enviados 2 PDFs numa requisição, mas **ambos saíram com o mesmo metadado**
(`tipoDocumento: INFRACAO`, `numeroDocumento: 1111111`) na lista do email.

Arquivos reais na requisição eram distintos:

- `FISCALIZE - AGEFIS.pdf` (207612 bytes)
- `Fiscalize.pdf` (174815 bytes)

## 2. Diagnóstico (por eliminação)

Pareamento atual é feito por **nome do arquivo** (`montarDocumentos`):

```js
const porArquivo = new Map((fields.documentos ?? []).map(d => [d.arquivo, d]))
files.map(file => {
  const meta = porArquivo.get(file.filename)
  tipo:   meta?.tipoDocumento ?? tipoPadrao   // padrão = 'Documento'
  numero: meta?.numeroDocumento ?? null
})
```

Cenários possíveis para 2 arquivos distintos:

| `documentos` JSON recebido        | file1                | file2                       |
| --------------------------------- | -------------------- | --------------------------- |
| 1 entrada (só FISCALIZE)          | INFRACAO / 1111111   | **Documento** / — (padrão)  |
| 2 entradas, ambas INFRACAO/1111111| INFRACAO / 1111111   | **INFRACAO / 1111111**      |

Sintoma = **ambos INFRACAO/1111111** → só bate com a 2ª linha.

**Conclusão:** o backend pareou certo. O `documentos` JSON já chegou com as duas
entradas idênticas. Se fosse falha de pareamento, o não-casado cairia no padrão
`'Documento'` — **nunca** INFRACAO. Ou seja: **bug de origem no frontend**, que
loopou os arquivos mas repetiu o mesmo metadado (variável compartilhada / não
atualizou tipo/numero por arquivo).

Reforço: `numeroDocumento: "1111111"`, `nome: "NÃO INFORMADO"` = dados de teste.

### Por que o log não deixou ver

O campo `documentos` é truncado em 80 chars no log (`resumoFields`), escondendo
a 2ª entrada do array. Para confirmar num request só, deixar de truncar o
`documentos`:

```js
// resumoFields
out[k] = k === 'documentos'
  ? v
  : (typeof v === 'string' && v.length > 80 ? `${v.slice(0, 80)}…` : v)
```

## 3. O trap real

O `?? 'Documento'` **silencioso**: um mismatch vira dado errado no PDF/email em vez
de erro. Idiot-proofing = tirar a decisão da mão de quem consome a API **e falhar
alto, nunca silencioso**.

## 4. Design proposto (à prova de idiotas)

Eliminar o pareamento por nome (frágil) e reduzir a 3 regras óbvias por
**contagem**. Sem depender de `arquivo`, sem casar string.

| `documentos` mandados | comportamento                                          |
| --------------------- | ------------------------------------------------------ |
| **0**                 | todos usam o tipo padrão do canal                      |
| **1**                 | aplica esse metadado a **TODOS** os arquivos (lote)    |
| **= nº de arquivos**  | 1 por arquivo, pareado por **ordem** do upload         |
| qualquer outro        | **400** com mensagem dizendo exatamente o que fazer    |

Contrato para o consumidor: "manda 1 metadado, ou 1 por arquivo". Impossível casar
nome errado. Contagem errada → erro explícito, não PDF errado.

Bônus: **eco na resposta 200** com o que foi de fato pareado → feedback loop.

### Trade-offs / pontos a refletir

- **Ordem do upload:** FormData do browser preserva ordem de `append`. Se o frontend
  monta num loop só (`append('arquivo', f); append('documentos', meta)`), a ordem
  sai certa sozinha. Risco: cliente que reordena partes (raro). Mitigação: a regra
  "1 metadado → todos" cobre o caso mais comum sem depender de ordem.
- **Perde-se o casamento explícito por nome.** Se algum dia precisar de ordem
  arbitrária arquivo↔metadado, a abordagem por índice não serve. Hoje não é o caso.
- **`arquivo` vira opcional** (só documentação), mantendo compat com quem já manda.

## 5. Código proposto

`montarDocumentos` (substitui ~linhas 90-104):

```js
/**
 * Pareia arquivos com tipo/numero por CONTAGEM (à prova de erro):
 * 0 metadados → padrão do canal; 1 → aplica a todos; N → um por arquivo (ordem).
 * @returns {{ file: object, tipo: string, numero: string|null }[]}
 */
function montarDocumentos(fields, files, tipoPadrao) {
	const docs = fields.documentos ?? []

	if (docs.length === 0) {
		return files.map(file => ({ file, tipo: tipoPadrao, numero: null }))
	}

	// 1 metadado aplica a TODOS os arquivos (lote do mesmo documento)
	if (docs.length === 1) {
		const { tipoDocumento, numeroDocumento } = docs[0]
		return files.map(file => ({
			file,
			tipo: tipoDocumento,
			numero: numeroDocumento ?? null
		}))
	}

	// N metadados → um por arquivo, na ordem do upload
	return files.map((file, i) => ({
		file,
		tipo: docs[i].tipoDocumento,
		numero: docs[i].numeroDocumento ?? null
	}))
}
```

`validarDocumentoFiscal` (substitui ~linhas 55-88) — falha alto, sem casar nome:

```js
/**
 * Regra do campo `documentos`: contagem deve ser 0, 1, ou igual ao nº de arquivos.
 * @returns {string|null} mensagem de erro ou null se ok
 */
function validarDocumentoFiscal(fields, files) {
	const docs = fields.documentos ?? []
	if (docs.length === 0 || docs.length === 1) return null
	if (docs.length !== files.length) {
		return `Você enviou ${files.length} arquivo(s) mas ${docs.length} entradas em "documentos". Envie 1 (aplica a todos) ou exatamente ${files.length} (um por arquivo, na ordem do upload).`
	}
	return null
}
```

Schema (`_documentos-fiscais.schema.js`) — `arquivo` deixa de ser obrigatório:

```js
z.object({
	arquivo: z.string().trim().min(1).optional(),  // ignorado no pareamento; só doc
	tipoDocumento: z
		.string({ error: 'documentos[].tipoDocumento é obrigatório' })
		.trim()
		.min(1),
	numeroDocumento: z.preprocess(
		x => (typeof x === 'string' && x.trim() === '' ? undefined : x),
		z.string().trim().min(1).optional()
	)
})
```

Eco na resposta 200 do email (dentro de `data`, ~linhas 485-496):

```js
documentos_enviados: documentos.map(d => ({
	tipo: d.tipo,
	numero: d.numero,
	arquivo: d.file.filename
})),
```

## 6. Escopo do fix

- `montarDocumentos` + `validarDocumentoFiscal` são **compartilhados** WhatsApp+Email
  → um único ajuste conserta os dois canais.
- Adicionar o eco também na resposta do WhatsApp (opcional, mesma ideia).

## 7. Decisão pendente

- [ ] Aplicar o design por contagem (0/1/N) ou manter por nome com validação mais dura?
- [ ] Confirmar antes com o log destruncado que a origem é mesmo o frontend?
- [ ] Corrigir também o frontend (não repetir metadado no loop)?
- [ ] (Separado) SMTP: `send()` trava sem log de conclusão — investigar timeout/rede
      e o `secure: SMTP_PORT === 465` que ignora `settings.SMTP_SECURE`.
