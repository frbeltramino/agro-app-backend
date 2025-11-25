# Agro API

## 🚀 Inicio

### Requerimientos

- Node.js v16.x
- MySQL v8.x

### Instalación

1. Clonar el repositorio
2. Instalar dependencias con `npm install`
3. Crear un archivo `.env` con las siguientes variables:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=agro_db
PORT=3000
SECRET_JWT_SEED=clave
```

4. Ejecutar el servidor con `nodemon server.js`