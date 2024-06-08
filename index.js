const express = require('express');
const sql = require('mssql');
const mysql = require('mysql2'); // Agrega la importación de MySQL
const cors = require('cors');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Configuración de la conexión a la base de datos SQL Server
const sqlConfig = {
  user: 'guest',
  password: '1234',
  server: '192.168.90.200\\SQLEXPRESS',
  database: 'E3_HSJD',
  options: {
    encrypt: false,
  },
};

// Configuración de la conexión a la base de datos MySQL
const mysqlConfig = {
  host: 'localhost',
  user: 'frank',
  password: 'admin',
  database: 'temperatura_laboratorio',
};

// Endpoint para la consulta SQL Server
app.get('/alarms', async (req, res) => {
  try {
    await sql.connect(sqlConfig);
    const result = await sql.query(`
      SELECT [E3TimeStamp]
           ,[Area]
           ,[FullAlarmSourceName]
           ,[Message]
           ,[Source]
      FROM [dbo].[Alarms]
      WHERE [Source] NOT LIKE '%PLC_Temperatura%'
      ORDER BY [E3TimeStamp] DESC;
;
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en el servidor');
  } finally {
    await sql.close();
  }
});

app.post('/temperatura', (req, res) => {
  try {
    const temperatureData = req.body;
	
    if (!Array.isArray(temperatureData)) {
      res.status(400).send('Se espera un array de datos de temperatura');
      return;
    }

    const mysqlConnection = mysql.createConnection(mysqlConfig);

    mysqlConnection.connect((err) => {
      if (err) {
        console.error('Error en la conexión MySQL:', err);
        res.status(500).send('Error en el servidor');
        return;
      }

      const query = 'INSERT INTO temperatura_historial (sensorId, temp) VALUES (?, ?)';

      // Iterar sobre cada objeto en el array y realizar la inserción
      temperatureData.forEach(({ sensorId, temp }) => {
        const values = [sensorId, temp];

        mysqlConnection.query(query, values, (mysqlErr, result) => {
          if (mysqlErr) {
            console.error('Error al insertar datos de temperatura:', mysqlErr);
            // Puedes elegir manejar el error de alguna manera específica
          }
        });
      });

      res.status(201).send('Datos de temperatura almacenados correctamente');

      mysqlConnection.end(); // Cierra la conexión después de todas las consultas
    });
  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).send('Error en el servidor');
  }
});


app.get('/temperatura', (req, res) => {
  try {
    const mysqlConnection = mysql.createConnection(mysqlConfig);

    mysqlConnection.connect((err) => {
      if (err) {
        console.error('Error en la conexión MySQL:', err);
        res.status(500).send('Error en el servidor');
        return;
      }

      const query = 'SELECT * FROM (SELECT sensorId, temp, timestamp FROM temperatura_historial ORDER BY timestamp DESC LIMIT 0,960 ) AS subquery ORDER BY timestamp ASC;'

      mysqlConnection.query(query, (mysqlErr, result) => {
        if (mysqlErr) {
          console.error('Error al obtener datos de temperatura:', mysqlErr);
          res.status(500).send('Error en el servidor');
          return;
        }

        // Crear un array de objetos con sensorId, temp y timestamp
        const formattedResult = result.reduce((acc, row) => {
          const { sensorId, temp, timestamp } = row;

          const existingSensor = acc.find(item => item.sensorId === sensorId);

          if (existingSensor) {
            existingSensor.temp.push(temp);
            existingSensor.timestamp.push(timestamp);
          } else {
            acc.push({
              sensorId,
              temp: [temp],
              timestamp: [timestamp]
            });
          }

          return acc;
        }, []);

        //console.log(formattedResult);

        res.json(formattedResult);

        mysqlConnection.end(); // Cierra la conexión después de la consulta
      });
    });
  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).send('Error en el servidor');
  }
});

/*
app.get('/temperaturaFiltrada', (req, res) => {
  try {
    const sensorId = req.params.sensorId; // Obtener el valor del parámetro sensorId de la consulta

    if (!sensorId) {
      res.status(400).send('Falta el parámetro sensorId');
      return;
    }

    const mysqlConnection = mysql.createConnection(mysqlConfig);

    mysqlConnection.connect((err) => {
      if (err) {
        console.error('Error en la conexión MySQL:', err);
        res.status(500).send('Error en el servidor');
        return;
      }

      const query = `SELECT temp, timestamp FROM temperatura_historial WHERE sensorId = ? ORDER BY timestamp ASC LIMIT 20000`;

      mysqlConnection.query(query, [sensorId], (mysqlErr, result) => {
        if (mysqlErr) {
          console.error('Error al obtener datos de temperatura:', mysqlErr);
          res.status(500).send('Error en el servidor');
          return;
        }

        const tempArray = [];
        const timestampArray = [];

        result.forEach(row => {
          tempArray.push(row.temp);
          timestampArray.push(row.timestamp);
        });

        const formattedResult = {
          sensorId: sensorId,
          temp: tempArray,
          timestamp: timestampArray
        };

        res.json(formattedResult);

        mysqlConnection.end(); // Cierra la conexión después de la consulta
      });
    });
  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).send('Error en el servidor');
  }
});
*/

app.get('/temperaturaFiltrada/:sensorId', (req, res) => {
  try {
    const sensorId = req.params.sensorId; // Obtener el valor del parámetro sensorId de la ruta
    const date = new Date(req.query.date); // Obtener y parsear la fecha de la consulta

    if (!sensorId || isNaN(date.getTime())) {
      res.status(400).send('Faltan parámetros o la fecha es inválida');
      return;
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1; // Los meses en JavaScript van de 0 a 11

    const mysqlConnection = mysql.createConnection(mysqlConfig);

    mysqlConnection.connect((err) => {
      if (err) {
        console.error('Error en la conexión MySQL:', err);
        res.status(500).send('Error en el servidor');
        return;
      }

      const query = `SELECT temp, timestamp
FROM temperatura_laboratorio.temperatura_historial
WHERE sensorId = ?
  AND YEAR(timestamp) = ?
  AND MONTH(timestamp) = ?
  AND MINUTE(timestamp) IN (0,15,30,45)
ORDER BY timestamp ASC;`


      mysqlConnection.query(query, [sensorId, year, month], (mysqlErr, result) => {
        if (mysqlErr) {
          console.error('Error al obtener datos de temperatura:', mysqlErr);
          res.status(500).send('Error en el servidor');
          return;
        }

        const tempArray = [];
        const timestampArray = [];

        result.forEach(row => {
          tempArray.push(row.temp);
          timestampArray.push(row.timestamp);
        });

        const formattedResult = {
          sensorId: sensorId,
          temp: tempArray,
          timestamp: timestampArray
        };

        res.json(formattedResult);

        mysqlConnection.end(); // Cierra la conexión después de la consulta
      });
    });
  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).send('Error en el servidor');
  }
});


app.get('/temperatura/:sensorId', (req, res) => {
  try {
    const sensorId = req.query.sensorId; // Obtener el valor del parámetro sensorId de la consulta
    const dateStart = req.query.startDate; // Obtener el valor del parámetro startDate de la consulta
    const dateEnd = req.query.endDate; // Obtener el valor del parámetro endDate de la consulta

    if (!sensorId || !dateStart || !dateEnd) {
      res.status(400).send('Faltan parámetros');
      return;
    }

    const mysqlConnection = mysql.createConnection(mysqlConfig);

    mysqlConnection.connect((err) => {
      if (err) {
        console.error('Error en la conexión MySQL:', err);
        res.status(500).send('Error en el servidor');
        return;
      }

            const query = `SELECT temp, timestamp
                     FROM temperatura_historial
                     WHERE sensorId = ?
                     AND timestamp BETWEEN ? AND ?
                     ORDER BY timestamp ASC`;

      mysqlConnection.query(query, [sensorId, dateStart, dateEnd], (mysqlErr, result) => {
        if (mysqlErr) {
          console.error('Error al obtener datos de temperatura:', mysqlErr);
          res.status(500).send('Error en el servidor');
          return;
        }

        const tempArray = [];
        const timestampArray = [];

        result.forEach(row => {
          tempArray.push(row.temp);
          timestampArray.push(row.timestamp);
        });

        const formattedResult = {
          sensorId: sensorId,
          temp: tempArray,
          timestamp: timestampArray
        };

        res.json(formattedResult);

        mysqlConnection.end(); // Cierra la conexión después de la consulta
      });
    });
  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).send('Error en el servidor');
  }
});


// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor en ejecución en http://localhost:${PORT}`);
});
