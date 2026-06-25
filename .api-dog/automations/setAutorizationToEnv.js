// Versão simples para capturar o JWT
if (pm.response.code === 200) {
	const response = pm.response.json()
	if (response.token) {
		pm.globals.set('Authorization', `Bearer ${response.token}`)
		console.log('✅ Token JWT salvo na variável Authorization')
	}
}
