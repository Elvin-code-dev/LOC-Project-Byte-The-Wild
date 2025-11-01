// Import the express module
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve the current directory path (needed for modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create an instance of an Express application
const app = express();

// Enable static file serving for our assets
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'data')));

// Allow the app to parse JSON bodies 
app.use(express.json());


// Define the port number where our server will listen
const PORT = process.env.PORT || 3004;

// Define the main "route" for our dashboard
// req = request info, res = response we send back
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Define the "history" route to show history.html
app.get(['/history', '/history.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'history.html'));
});

// Handle any unknown routes with a simple 404 message
app.use((req, res) => {
  res.status(404).send('Page Not Found');
});

// Start the server and make it listen on the port
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
