# Run the Node backend using a local MongoDB instance (Windows PowerShell)
# Usage: open PowerShell in the backend folder and run: .\start_with_local_mongo.ps1

$env:MONGO_URL = "mongodb://127.0.0.1:27017"
$env:DB_NAME = "kanban_board"
$env:CORS_ORIGINS = "http://localhost:3000"
$env:SECRET_KEY = "kanban-secret-key-change-in-production-2024"

Write-Output "Environment variables set for local MongoDB. Starting server..."

npm start
