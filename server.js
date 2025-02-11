const express = require('express');
const bodyParser = require('body-parser');
const oracledb = require('oracledb');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const cors = require('cors')


// Initialize dotenv to load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(cors())
    // Function to hash a password using SHA-256
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}


const validTableNames = ['users', 'bon_livraison', 'produit', 'bon_affectation', 'bon_sortie', 'categorie', 'command', 'concerner', 'contenir', 'departement', "employe", "fournisseur", "produit", "renfermer", "se_refere"]; // List your valid table names here

// Function to verify a password
function verifyPassword(inputPassword, storedHash) {
    const inputHash = hashPassword(inputPassword);
    return inputHash === storedHash;
}

function decodeToken(token) {
    try {
        jwt.verify(token, process.env.JWT_SECRET);
        return true;
    } catch (err) {
        return false;
    }
}




// Function to create the SQL query string
function select_table(name) {
    return `SELECT * FROM ${name}`;
}

// GET route to query a table dynamically
app.get('/select', async(req, res) => {
    const { name } = req.query; // Assuming the table name is passed as a query parameter, e.g., /test?name=users
    console.log(name)
    const token = req.headers['authorization'] // Extract the username from the token
    let cond = decodeToken(token)
    if (!cond) {
        return res.status(400).json({ message: 'invalid access' });

    }
    if (!name) {
        return res.status(400).json({ message: 'Table name is required' });
    }

    // Validate table name (basic sanitization to prevent SQL injection)
    if (!validTableNames.includes(name)) {
        return res.status(400).json({ message: 'Invalid table name' });
    }

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const query = select_table(name); // Build the query dynamically
        const result = await connection.execute(query); // Execute the query

        // Map the result to a dictionary of column names with respective values
        const rows = result.rows.map(row => {
            const rowObj = {};
            result.metaData.forEach((column, index) => {
                rowObj[column.name] = row[index];
            });
            return rowObj;
        });

        res.status(200).json(rows); // Send back the result rows as a JSON response
    } catch (err) {
        console.error('Database query failed:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (connection) {
            try {
                await connection.close(); // Ensure connection is closed after query
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

app.post('/insert', async(req, res) => {

    const { name, data } = req.body; // Extract the table name and data from the request
    console.log(data)
    const token = req.headers['authorization'] // Extract the username from the token
    let cond = decodeToken(token)
    if (!cond) {
        return res.status(400).json({ message: 'invalid access' });

    }
    if (!name || !data) {
        return res.status(400).json({ message: 'Table name and data are required' });
    }

    // Validate table name (basic sanitization to prevent SQL injection)
    if (!validTableNames.includes(name)) {
        return res.status(400).json({ message: 'Invalid table name' });
    }

    // Prepare column names and values from the data object
    const columns = Object.keys(data);
    const values = Object.values(data);

    // Escape values (for simplicity, using a simple escape function here)
    const escapedValues = values.map((value, index) => {
        if (typeof value === 'string') {
            if (index === columns.indexOf('DATE_STOCK')) {
                // If it's the DATE_STOCK field, we need to format it properly
                return `TO_DATE('${value.replace(/'/g, "''")}', 'yyyy-mm-dd')`; // Handle date format
            }
            return `'${value.replace(/'/g, "''")}'`; // Escape single quotes in strings
        }
        return value; // Assume numbers or other data types are safe
    });

    // Build the INSERT query dynamically
    const query = `INSERT INTO ${name} (${columns.join(', ')}) VALUES (${escapedValues.join(', ')})`;

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // Execute the query
        await connection.execute(query, [], { autoCommit: true });

        res.status(201).json({ message: 'Record inserted successfully' });
    } catch (err) {
        console.error('Database insert failed:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (connection) {
            try {
                await connection.close(); // Ensure connection is closed after query
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

app.post('/update', async(req, res) => {
    const { name, data } = req.body; // Extract the table name and data from the request
    const token = req.headers['authorization'] // Extract the username from the token
    let cond = decodeToken(token)
    if (!cond) {
        return res.status(400).json({ message: 'invalid access' });

    }

    if (!name || !data) {
        return res.status(400).json({ message: 'Table name and data are required' });
    }

    if (!validTableNames.includes(name)) {
        return res.status(400).json({ message: 'Invalid table name' });
    }
    const columns = Object.keys(data);
    const values = Object.values(data);

    // Escape values (for simplicity, using a simple escape function here)
    const escapedValues = values.map((value, index) => {
        if (typeof value === 'string') {
            if (index === columns.indexOf('DATE_STOCK')) {
                // If it's the DATE_STOCK field, we need to format it properly
                return `TO_DATE('${value.replace(/'/g, "''")}', 'yyyy-mm-dd')`; // Handle date format
            }
            return `'${value.replace(/'/g, "''")}'`; // Escape single quotes in strings
        }
        return value; // Assume numbers or other data types are safe
    });

    // You would need a condition for the `WHERE` clause (usually primary key or unique column)
    const whereCondition = `WHERE ${columns[0]} = ${escapedValues[0]}`; // Assuming the first column is a unique identifier

    // Build the UPDATE query dynamically
    const setClause = columns.map((col, index) => `${col} = ${escapedValues[index]}`).join(', ');

    const query = `UPDATE ${name} SET ${setClause} ${whereCondition}`;

    console.log(query); // For debugging, print the generated query

    // Example for executing the query (assuming you're using something like Oracle DB with a connection)
    // await connection.execute(query);

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // Execute the query
        await connection.execute(query, [], { autoCommit: true });

        res.status(201).json({ message: 'Record inserted successfully' });
    } catch (err) {
        console.error('Database update failed:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (connection) {
            try {
                await connection.close(); // Ensure connection is closed after query
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }



})

app.delete('/delete', async(req, res) => {
    const { name, data } = req.body;
    const token = req.headers['authorization'] // Extract the username from the token
    let cond = decodeToken(token)
    if (!cond) {
        return res.status(400).json({ message: 'invalid access' });

    }
    // Extract the table name and data (conditions for delete) from the request
    if (!name || !data) {
        return res.status(400).json({ message: 'Table name and data are required' });
    }


    if (!validTableNames.includes(name)) {
        return res.status(400).json({ message: 'Invalid table name' });
    }

    const columns = Object.keys(data);
    const values = Object.values(data);



    // Build the DELETE query dynamically
    const query = `DELETE FROM ${name}
        WHERE ${columns[0]} = ${values[0]}
    `;

    console.log(query); // For debugging, print the generated query

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        // Execute the DELETE query
        await connection.execute(query, [], { autoCommit: true });

        res.status(200).json({ message: 'Record deleted successfully' });
    } catch (err) {
        console.error('Database delete failed:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (connection) {
            try {
                await connection.close(); // Ensure connection is closed after query
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});





// Initialize Oracle client
oracledb.initOracleClient({}); // Update with your Oracle client path

// Database connection configuration from .env
const dbConfig = {
    user: "user1",
    password: "user1",
    connectString: "localhost/xe"
};

// Function to generate JWT token
function generateToken(username) {
    return jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// Login endpoint
app.post('/login', async(req, res) => {
    const { username, password } = req.body;
    console.log(username, password)
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        // Connect to the Oracle database
        connection = await oracledb.getConnection(dbConfig);
        // Query the database for the user's hashed password
        const query = 'SELECT password_hash FROM users WHERE username = :username';
        const result = await connection.execute(query, [username]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const storedHash = result.rows[0][0]; // Get the hashed password from the query result

        // Verify the password
        const isMatch = verifyPassword(password, storedHash);
        if (isMatch) {
            // Generate JWT token
            const token = generateToken(username);
            res.status(200).json({ message: 'Login successful!', token });
        } else {
            res.status(401).json({ message: 'Invalid password!' });
        }
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// Middleware to authenticate and verify JWT token
// Middleware to authenticate and verify JWT token



// Example of a protected route (requires valid JWT token)


// Start the server
const PORT = 5445;
app.listen(PORT, '192.168.166.89', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});