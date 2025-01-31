const oracledb = require("oracledb");

async function runApp() {
    oracledb.initOracleClient(); // Initialize the Oracle client

    let connection;
    try {
        connection = await oracledb.getConnection({
            user: "user1",
            password: "user1",
            connectionString: "localhost/xe",
        });

        console.log("Successfully connected to Oracle Database");

        // Query the DBA_USERS table
        const sql = `select * from categorie`;
        const result = await connection.execute(sql, [], { resultSet: true });

        const rs = result.resultSet;

        // Fetch rows from the result set
        let row;
        while ((row = await rs.getRow())) {
            console.log(row); // Process each row (logs it in this case)
        }

        // Close the result set after processing
        await rs.close();
    } catch (err) {
        console.error("Error:", err);
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log("Connection closed");
            } catch (err) {
                console.error("Error closing connection:", err);
            }
        }
    }
}

runApp();