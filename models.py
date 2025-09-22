from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import bcrypt

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Onboarding fields
    goals = db.Column(db.Text)  # JSON string of goals
    schedule = db.Column(db.String(50))  # e.g., "3-4 days/week"
    equipment = db.Column(db.Text)  # JSON string of available equipment
    experience_level = db.Column(db.String(20))  # beginner, intermediate, advanced
    onboarding_completed = db.Column(db.Boolean, default=False)
    
    # Relationships
    workout_logs = db.relationship('WorkoutLog', backref='user', lazy=True)
    
    def set_password(self, password):
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'goals': self.goals,
            'schedule': self.schedule,
            'equipment': self.equipment,
            'experience_level': self.experience_level,
            'onboarding_completed': self.onboarding_completed,
            'created_at': self.created_at.isoformat()
        }

class Exercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)  # push, pull, legs, upper, lower
    muscle_groups = db.Column(db.Text)  # JSON string of muscle groups
    equipment_needed = db.Column(db.Text)  # JSON string of equipment
    instructions = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'muscle_groups': self.muscle_groups,
            'equipment_needed': self.equipment_needed,
            'instructions': self.instructions
        }

class WorkoutTemplate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # upper_lower, push_pull_legs
    description = db.Column(db.Text)
    
    # Relationships
    template_exercises = db.relationship('TemplateExercise', backref='template', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'description': self.description,
            'exercises': [te.to_dict() for te in self.template_exercises]
        }

class TemplateExercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('workout_template.id'), nullable=False)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=False)
    sets = db.Column(db.Integer, nullable=False)
    reps_range = db.Column(db.String(20))  # e.g., "8-12", "5"
    order = db.Column(db.Integer, nullable=False)
    
    # Relationships
    exercise = db.relationship('Exercise', backref='template_uses')
    
    def to_dict(self):
        return {
            'id': self.id,
            'exercise': self.exercise.to_dict(),
            'sets': self.sets,
            'reps_range': self.reps_range,
            'order': self.order
        }

class WorkoutLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    template_id = db.Column(db.Integer, db.ForeignKey('workout_template.id'))
    date = db.Column(db.DateTime, default=datetime.utcnow)
    duration_minutes = db.Column(db.Integer)
    notes = db.Column(db.Text)
    
    # Relationships
    set_logs = db.relationship('SetLog', backref='workout', lazy=True)
    template = db.relationship('WorkoutTemplate', backref='workout_logs')
    
    def to_dict(self):
        return {
            'id': self.id,
            'template': self.template.to_dict() if self.template else None,
            'date': self.date.isoformat(),
            'duration_minutes': self.duration_minutes,
            'notes': self.notes,
            'sets': [s.to_dict() for s in self.set_logs]
        }

class SetLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    workout_log_id = db.Column(db.Integer, db.ForeignKey('workout_log.id'), nullable=False)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=False)
    set_number = db.Column(db.Integer, nullable=False)
    weight = db.Column(db.Float)
    reps = db.Column(db.Integer, nullable=False)
    rpe = db.Column(db.Integer)  # Rate of Perceived Exertion (1-10)
    
    # Relationships
    exercise = db.relationship('Exercise', backref='set_logs')
    
    def to_dict(self):
        return {
            'id': self.id,
            'exercise': self.exercise.to_dict(),
            'set_number': self.set_number,
            'weight': self.weight,
            'reps': self.reps,
            'rpe': self.rpe
        }
