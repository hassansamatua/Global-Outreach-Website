# Global Outreach - Modern Non-Profit Organization Website

A full-stack web application for Global Outreach, a non-profit organization, featuring a modern UI/UX with an admin panel for content management.

## Features

- **Modern, responsive design** built with React and Material-UI
- **Admin Panel** for content management
- **User Authentication** for admin access
- **Content Management System** for dynamic content updates
- **Donation System** for accepting contributions
- **Event Management** for organizing and promoting events
- **Blog/News** section for updates and stories

## Tech Stack

### Frontend
- React
- Material-UI
- React Router
- Axios
- Framer Motion (for animations)
- FullCalendar (for event management)

### Backend
- Node.js
- Express.js
- MySQL
- JWT Authentication
- Multer (for file uploads)
- Express Validator

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MySQL Server

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/global-outreach.git
   cd global-outreach
   ```

2. **Set up the backend**
   ```bash
   cd server
   npm install
   cp .env.example .env
   # Update .env with your database credentials
   ```

3. **Set up the frontend**
   ```bash
   cd ../client
   npm install
   ```

4. **Start the development servers**
   - In the server directory: `npm run server`
   - In the client directory: `npm start`

5. Open [http://localhost:3000](http://localhost:3000) to view the app in the browser.

## Project Structure

```
global-outreach/
├── client/                 # Frontend React application
│   ├── public/            # Static files
│   └── src/               # React source code
│       ├── components/    # Reusable UI components
│       ├── pages/         # Page components
│       ├── assets/        # Images, fonts, etc.
│       ├── styles/        # Global styles
│       ├── utils/         # Helper functions
│       ├── App.js         # Main App component
│       └── index.js       # Entry point
│
├── server/                # Backend Express server
│   ├── src/
│   │   ├── config/       # Configuration files
│   │   ├── controllers/  # Route controllers
│   │   ├── middleware/   # Custom middleware
│   │   ├── models/       # Database models
│   │   ├── routes/       # API routes
│   │   ├── utils/        # Utility functions
│   │   └── server.js     # Server entry point
│   └── .env              # Environment variables
│
└── README.md             # This file
```

## Environment Variables

Create a `.env` file in the `server` directory with the following variables:

```
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_here
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=global_outreach
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Material-UI](https://material-ui.com/)
- [React](https://reactjs.org/)
- [Express](https://expressjs.com/)
- [MySQL](https://www.mysql.com/)
