# Privilege Escalation Web Demo

A demonstration of a privilege escalation vulnerability and its fix.

## Prerequisites
- Node.js (v14 or later)
- npm (v6 or later)

## How to Run

1. **Install Dependencies**
   Navigate to the `server` directory and install the required npm packages:
   ```bash
   cd server
   npm install
   ```

2. **Start the Server**
   Run the application using Node.js:
   ```bash
   node app.js
   ```
   The server will start on `http://localhost:3000`.

3. **Access the Demo**
   Open your browser and go to:
   [http://localhost:3000](http://localhost:3000)

## Demo Modes
The application features two modes:
- **VULNERABLE**: Demonstrates how an attacker can escalate privileges by manipulating user data.
- **FIXED**: Shows the secure implementation that prevents the attack.

You can toggle between modes using the controls provided in the web interface.
