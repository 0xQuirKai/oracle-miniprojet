const express = require('express');
const bodyParser = require('body-parser');
const oracledb = require('oracledb');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Initialize dotenv to load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(bodyParser.json()); // Parse JSON request bodies

// Function to hash a password using SHA-256
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Function to verify a password
function verifyPassword(inputPassword, storedHash) {
    const inputHash = hashPassword(inputPassword);
    return inputHash === storedHash;
}

function decodeToken(token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        console.log("JWT_SECRET:", process.env.JWT_SECRET);

        if (err) {
            console.log(err)

        }
    })

    const decoded = jwt.decode(token); // This decodes the token and returns the payload
    console.log(decoded); // The decoded token contains the user info
    return decoded;
}
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

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    let connection;
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
function authenticateToken(token) {
    return decodeToken(token)

}


// Example of a protected route (requires valid JWT token)
app.get('/protected', (req, res) => {
    const token = req.headers['authorization'].replace('Bearer ', ''); // Extract the username from the token
    console.log(authenticateToken(token))
    res.status(200).json({
        message: 'Protected route accessed',
    });
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});