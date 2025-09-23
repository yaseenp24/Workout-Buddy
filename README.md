# Fitness Tracker App

A comprehensive fitness tracking application with user accounts, workout planning, and progress logging.

## Features

- User registration and authentication
- Onboarding flow (goals, schedule, equipment)
- Pre-seeded workout templates (Upper/Lower, Push/Pull/Legs)
- Workout logging (exercise, weight, reps, RPE)
- Workout history tracking

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Backend**: Python Flask
- **Database**: SQLite with SQLAlchemy

## Setup Instructions

### Backend Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt 
```

2. Run the Flask application:
```bash
python app.py
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Start the frontend server:
```bash
npm start
```

The frontend will be available at `http://localhost:8080`

## API Endpoints

- `POST /api/register` - User registration
- `POST /api/login` - User login
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/onboarding` - Complete user onboarding
- `GET /api/workouts/templates` - Get workout templates
- `POST /api/workouts/log` - Log a workout
- `GET /api/workouts/history` - Get workout history

## Database Schema

- **users**: User accounts and profile information
- **workout_templates**: Pre-defined workout plans
- **exercises**: Exercise database
- **workout_logs**: Individual workout sessions
- **set_logs**: Individual set records
