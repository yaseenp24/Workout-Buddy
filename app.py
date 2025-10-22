from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from models import db, User, Exercise, WorkoutTemplate, TemplateExercise, WorkoutLog, SetLog
import json
from datetime import datetime, timedelta 
import os
 
try:
    import google.generativeai as genai
    _HAS_GEMINI = True
except Exception:
    _HAS_GEMINI = False 
 
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///fitness_tracker.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-insecure-secret')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)

db.init_app(app)
jwt = JWTManager(app)
CORS(app)

# User Authentication Routes
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password') or not data.get('name'):
            return jsonify({'error': 'Email, password, and name are required'}), 400
        
        # Check if user already exists
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already registered'}), 400
        
        # Create new user
        user = User(
            email=data['email'],
            name=data['name']
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        # Create access token
        access_token = create_access_token(identity=user.id)
        
        return jsonify({
            'message': 'User registered successfully',
            'access_token': access_token,
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400
        
        user = User.query.filter_by(email=data['email']).first()
        
        if user and user.check_password(data['password']):
            access_token = create_access_token(identity=user.id)
            return jsonify({
                'message': 'Login successful',
                'access_token': access_token,
                'user': user.to_dict()
            }), 200
        else:
            return jsonify({'error': 'Invalid credentials'}), 401
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/profile', methods=['GET'])
@jwt_required()
def get_profile():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        return jsonify({'user': user.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/onboarding', methods=['PUT'])
@jwt_required()
def complete_onboarding():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        user.goals = json.dumps(data.get('goals', []))
        user.schedule = data.get('schedule')
        user.equipment = json.dumps(data.get('equipment', []))
        user.experience_level = data.get('experience_level')
        user.onboarding_completed = True
        
        db.session.commit()
        
        return jsonify({
            'message': 'Onboarding completed successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Workout Template Routes
@app.route('/api/workouts/templates', methods=['GET'])
@jwt_required()
def get_workout_templates():
    try:
        templates = WorkoutTemplate.query.all()
        return jsonify({
            'templates': [template.to_dict() for template in templates]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/exercises', methods=['GET'])
@jwt_required()
def get_exercises():
    try:
        category = request.args.get('category')
        if category:
            exercises = Exercise.query.filter_by(category=category).all()
        else:
            exercises = Exercise.query.all()
            
        return jsonify({
            'exercises': [exercise.to_dict() for exercise in exercises]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Workout Logging Routes for the system
@app.route('/api/workouts/log', methods=['POST'])
@jwt_required()
def log_workout():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Create workout log
        workout_log = WorkoutLog(
            user_id=user_id,
            template_id=data.get('template_id'),
            duration_minutes=data.get('duration_minutes'),
            notes=data.get('notes', '')
        )
        
        db.session.add(workout_log)
        db.session.flush()  # Get the ID
        
        # Add set logs
        for set_data in data.get('sets', []):
            set_log = SetLog(
                workout_log_id=workout_log.id,
                exercise_id=set_data['exercise_id'],
                set_number=set_data['set_number'],
                weight=set_data.get('weight'),
                reps=set_data['reps'],
                rpe=set_data.get('rpe')
            ) 
            db.session.add(set_log)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Workout logged successfully',
            'workout': workout_log.to_dict()
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/workouts/history', methods=['GET'])
@jwt_required()
def get_workout_history():
    try:
        user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        workouts = WorkoutLog.query.filter_by(user_id=user_id)\
                                 .order_by(WorkoutLog.date.desc())\
                                 .paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'workouts': [workout.to_dict() for workout in workouts.items],
            'total': workouts.total,
            'pages': workouts.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/workouts/<int:workout_id>', methods=['GET'])
@jwt_required()
def get_workout_details(workout_id):
    try:
        user_id = get_jwt_identity()
        workout = WorkoutLog.query.filter_by(id=workout_id, user_id=user_id).first()
        
        if not workout:
            return jsonify({'error': 'Workout not found'}), 404
            
        return jsonify({'workout': workout.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def seed_data():
    """Seed the database with initial data"""
    
    # Create exercises
    exercises_data = [
        # Push exercises
        {'name': 'Bench Press', 'category': 'push', 'muscle_groups': '["chest", "triceps", "shoulders"]', 'equipment_needed': '["barbell", "bench"]'},
        {'name': 'Overhead Press', 'category': 'push', 'muscle_groups': '["shoulders", "triceps"]', 'equipment_needed': '["barbell"]'},
        {'name': 'Incline Dumbbell Press', 'category': 'push', 'muscle_groups': '["chest", "shoulders"]', 'equipment_needed': '["dumbbells", "bench"]'},
        {'name': 'Dips', 'category': 'push', 'muscle_groups': '["chest", "triceps"]', 'equipment_needed': '["dip_bars"]'},
        
        # Pull exercises
        {'name': 'Pull-ups', 'category': 'pull', 'muscle_groups': '["lats", "biceps"]', 'equipment_needed': '["pull_up_bar"]'},
        {'name': 'Barbell Rows', 'category': 'pull', 'muscle_groups': '["lats", "rhomboids", "biceps"]', 'equipment_needed': '["barbell"]'},
        {'name': 'Lat Pulldowns', 'category': 'pull', 'muscle_groups': '["lats", "biceps"]', 'equipment_needed': '["cable_machine"]'},
        {'name': 'Face Pulls', 'category': 'pull', 'muscle_groups': '["rear_delts", "rhomboids"]', 'equipment_needed': '["cable_machine"]'},
        
        # Legs exercises
        {'name': 'Squats', 'category': 'legs', 'muscle_groups': '["quads", "glutes"]', 'equipment_needed': '["barbell"]'},
        {'name': 'Deadlifts', 'category': 'legs', 'muscle_groups': '["hamstrings", "glutes", "lower_back"]', 'equipment_needed': '["barbell"]'},
        {'name': 'Romanian Deadlifts', 'category': 'legs', 'muscle_groups': '["hamstrings", "glutes"]', 'equipment_needed': '["barbell"]'},
        {'name': 'Leg Press', 'category': 'legs', 'muscle_groups': '["quads", "glutes"]', 'equipment_needed': '["leg_press_machine"]'},
        
        # Upper body compound
        {'name': 'Barbell Curls', 'category': 'upper', 'muscle_groups': '["biceps"]', 'equipment_needed': '["barbell"]'},
        {'name': 'Close-Grip Bench Press', 'category': 'upper', 'muscle_groups': '["triceps", "chest"]', 'equipment_needed': '["barbell", "bench"]'},
        
        # Lower body
        {'name': 'Calf Raises', 'category': 'lower', 'muscle_groups': '["calves"]', 'equipment_needed': '["none"]'},
        {'name': 'Lunges', 'category': 'lower', 'muscle_groups': '["quads", "glutes"]', 'equipment_needed': '["dumbbells"]'}
    ]
    
    for exercise_data in exercises_data:
        if not Exercise.query.filter_by(name=exercise_data['name']).first():
            exercise = Exercise(**exercise_data)
            db.session.add(exercise)
    
    db.session.commit()
    
    # Create workout templates
    # Push/Pull/Legs template
    ppl_template = WorkoutTemplate(
        name='Push/Pull/Legs',
        type='push_pull_legs',
        description='A 3-day split focusing on pushing movements, pulling movements, and leg exercises'
    )
    db.session.add(ppl_template)
    db.session.flush()
    
    # Upper/Lower template
    ul_template = WorkoutTemplate(
        name='Upper/Lower',
        type='upper_lower',
        description='A 2-day split alternating between upper body and lower body exercises'
    )
    db.session.add(ul_template)
    db.session.flush()
    
    # Add exercises to Push/Pull/Legs template
    ppl_exercises = [
        {'exercise_name': 'Bench Press', 'sets': 4, 'reps_range': '6-8', 'order': 1},
        {'exercise_name': 'Overhead Press', 'sets': 3, 'reps_range': '8-10', 'order': 2},
        {'exercise_name': 'Incline Dumbbell Press', 'sets': 3, 'reps_range': '10-12', 'order': 3},
        {'exercise_name': 'Dips', 'sets': 3, 'reps_range': '12-15', 'order': 4}
    ]
    
    for i, ex_data in enumerate(ppl_exercises):
        exercise = Exercise.query.filter_by(name=ex_data['exercise_name']).first()
        if exercise:
            template_exercise = TemplateExercise(
                template_id=ppl_template.id,
                exercise_id=exercise.id,
                sets=ex_data['sets'],
                reps_range=ex_data['reps_range'],
                order=ex_data['order']
            )
            db.session.add(template_exercise)
    
    # Add exercises to Upper/Lower template
    ul_exercises = [
        {'exercise_name': 'Bench Press', 'sets': 4, 'reps_range': '6-8', 'order': 1},
        {'exercise_name': 'Barbell Rows', 'sets': 4, 'reps_range': '6-8', 'order': 2},
        {'exercise_name': 'Overhead Press', 'sets': 3, 'reps_range': '8-10', 'order': 3},
        {'exercise_name': 'Pull-ups', 'sets': 3, 'reps_range': '8-12', 'order': 4}
    ]
    
    for ex_data in ul_exercises:
        exercise = Exercise.query.filter_by(name=ex_data['exercise_name']).first()
        if exercise:
            template_exercise = TemplateExercise(
                template_id=ul_template.id,
                exercise_id=exercise.id,
                sets=ex_data['sets'],
                reps_range=ex_data['reps_range'],
                order=ex_data['order']
            )
            db.session.add(template_exercise)
    
    db.session.commit()
    print("Database seeded successfully!")

# --------- AI: Profile Tips ---------
def _profile_to_prompt(profile: dict) -> str:
    goals = ", ".join(profile.get('goals', [])) or "unspecified goals"
    equipment = ", ".join(profile.get('equipment', [])) or "no equipment"
    schedule = profile.get('schedule') or "unspecified schedule"
    experience = profile.get('experience_level') or "unspecified experience"
    return (
        f"User profile:\n"
        f"- Goals: {goals}\n"
        f"- Schedule: {schedule}\n"
        f"- Equipment: {equipment}\n"
        f"- Experience: {experience}\n\n"
        f"Provide 5 concise, actionable training tips tailored to the user."
        f" Focus on exercise selection, progression, recovery, and adherence."
        f" Use bullet points, 1 sentence each."
    )

def _local_tips(profile: dict):
    tips = []
    goals = set(profile.get('goals', []))
    equipment = set(profile.get('equipment', []))
    schedule = (profile.get('schedule') or '').lower()
    experience = (profile.get('experience_level') or '').lower()

    if 'muscle_gain' in goals or 'strength' in goals:
        tips.append("Prioritize compound lifts and add small weekly load or rep increases.")
    if 'weight_loss' in goals:
        tips.append("Keep rests short and add brisk walks on non-training days to raise weekly activity.")
    if 'endurance' in goals:
        tips.append("Include 1–2 zone-2 cardio sessions weekly alongside resistance training.")
    if 'cable_machine' in equipment:
        tips.append("Use cable moves to keep tension constant for accessories like rows and face pulls.")
    if 'bodyweight_only' in equipment and not equipment - {'bodyweight_only'}:
        tips.append("Use slow eccentrics and pause reps to make bodyweight sessions more effective.")
    if '3-4' in schedule or '3-4 days' in schedule:
        tips.append("Run a simple upper/lower split across two alternating days each week.")
    if experience in ('beginner', '0-1 years'):
        tips.append("Repeat the same key lifts to build skill; keep RPE ~7–8 and track every session.")
    if not tips:
        tips = [
            "Aim for 8–12 hard sets per muscle per week and log all sessions.",
            "Warm up with lighter sets, then keep working sets within 2–3 reps of failure.",
            "Progress either weight or reps each week on your main lifts.",
            "Sleep 7–9 hours and keep protein ~1.6–2.2 g/kg bodyweight.",
            "Deload 1 week every 6–8 weeks or when fatigue accumulates."
        ]
    return tips[:5]

@app.route('/api/ai/profile-tips', methods=['POST'])
def profile_tips():
    try:
        data = request.get_json() or {}
        # Allow auth-based fetch if token present
        if not data.get('profile') and request.headers.get('Authorization'):
            try:
                user_id = get_jwt_identity()
                if user_id:
                    user = User.query.get(user_id)
                    if user:
                        data['profile'] = {
                            'goals': json.loads(user.goals) if user.goals else [],
                            'schedule': user.schedule,
                            'equipment': json.loads(user.equipment) if user.equipment else [],
                            'experience_level': user.experience_level
                        }
            except Exception:
                pass

        profile = data.get('profile') or {}

        # If Gemini configured, call it
        if _HAS_GEMINI and os.getenv('GOOGLE_API_KEY'):
            try:
                genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
                model = genai.GenerativeModel('gemini-1.5-flash')
                prompt = _profile_to_prompt(profile)
                resp = model.generate_content(prompt)
                text = (resp.text or '').strip()
                # Return as lines
                tips = [line.lstrip('-• ').strip() for line in text.split('\n') if line.strip()][:5]
                if tips:
                    return jsonify({'tips': tips}), 200
            except Exception:
                pass

        # Fallback local tips
        return jsonify({'tips': _local_tips(profile)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_data()
    
    app.run(host='0.0.0.0', debug=True, port=5000)
