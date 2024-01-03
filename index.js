const express = require('express');
const sql = require('mssql');
const cors = require('cors'); // Agrega la importación de CORS

const app = express();
const PORT = 3000;

app.use(cors());


// Configuración de la conexión a la base de datos
const config = {
  user: 'guest',
  password: '1234',
  server: '192.168.90.200\\SQLEXPRESS', // Puede ser una dirección IP
  database: 'E3_HSJD',
  options: {
    encrypt: false, // Dependiendo de tu configuración de SQL Server
  },
};

// Endpoint para la consulta SQL
app.get('/alarms', async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT [E3TimeStamp]
           ,[Area]
           ,[FullAlarmSourceName]
           ,[InTime]
           ,[Message]
           ,[Source]
      FROM [dbo].[Alarms]
      WHERE [Source] NOT LIKE '%PLC_Temperatura%';
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el servidor');
  } finally {
    await sql.close();
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor en ejecución en http://localhost:${PORT}`);
});
