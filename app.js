// Global state
let currentUser = null;
let authToken = null;
let currentWorkout = null;
let workoutTimer = null;
let workoutStartTime = null;

// API base URL
const API_BASE = 'http://localhost:5000/api';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        authToken = token;
        currentUser = JSON.parse(user);
        
        if (!currentUser.onboarding_completed) {
            showOnboarding();
        } else {
            showApp();
        }
    } else {
        showAuth();
    }
    
    // Set up form handlers
    setupEventListeners();
});

function setupEventListeners() {
    // Auth forms
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('onboarding-form').addEventListener('submit', handleOnboarding);
}

// Authentication functions
function showLogin() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function showRegister() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

async function handleLogin(e) {
    e.preventDefault();
    showLoading();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.access_token;
            currentUser = data.user;
            
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            if (!currentUser.onboarding_completed) {
                showOnboarding();
            } else {
                showApp();
            }
            
            showToast('Login successful!', 'success');
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
    
    hideLoading();
}

async function handleRegister(e) {
    e.preventDefault();
    showLoading();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.access_token;
            currentUser = data.user;
            
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            showOnboarding();
            showToast('Registration successful!', 'success');
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
    
    hideLoading();
}

async function handleOnboarding(e) {
    e.preventDefault();
    showLoading();
    
    const goals = Array.from(document.querySelectorAll('#onboarding-form input[type="checkbox"]:checked'))
                      .map(cb => cb.value);
    const schedule = document.getElementById('schedule').value;
    const equipment = Array.from(document.querySelectorAll('#onboarding-form input[value]:checked'))
                           .filter(cb => cb.name !== 'goals')
                           .map(cb => cb.value);
    const experienceLevel = document.getElementById('experience-level').value;
    
    try {
        const response = await fetch(`${API_BASE}/user/onboarding`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                goals,
                schedule,
                equipment,
                experience_level: experienceLevel
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            showApp();
            showToast('Profile setup complete!', 'success');
        } else {
            showToast(data.error || 'Setup failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
    
    hideLoading();
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    authToken = null;
    currentUser = null;
    showAuth();
    showToast('Logged out successfully', 'success');
}

// Navigation functions
function showAuth() {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('onboarding-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'none';
    document.getElementById('navbar').style.display = 'none';
}

function showOnboarding() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('onboarding-section').style.display = 'block';
    document.getElementById('app-section').style.display = 'none';
    document.getElementById('navbar').style.display = 'none';
}

function showApp() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('onboarding-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'block';
    document.getElementById('navbar').style.display = 'block';
    
    showDashboard();
    loadDashboardData();
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(sectionId).style.display = 'block';
}

function showDashboard() {
    showSection('dashboard');
    loadDashboardData();
}

function showWorkoutTemplates() {
    showSection('workout-templates');
    loadWorkoutTemplates();
}

function showWorkoutHistory() {
    showSection('workout-history');
    loadWorkoutHistory();
}

// Dashboard functions
async function loadDashboardData() {
    try {
        const response = await fetch(`${API_BASE}/workouts/history?per_page=100`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            updateDashboardStats(data.workouts);
        }
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

function updateDashboardStats(workouts) {
    const totalWorkouts = workouts.length;
    
    // Calculate this week's workouts
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekWorkouts = workouts.filter(w => new Date(w.date) >= oneWeekAgo).length;
    
    // Calculate streak (simplified - consecutive days with workouts)
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const hasWorkout = workouts.some(w => {
            const workoutDate = new Date(w.date);
            return workoutDate.toDateString() === checkDate.toDateString();
        });
        
        if (hasWorkout) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }
    
    document.getElementById('total-workouts').textContent = totalWorkouts;
    document.getElementById('week-workouts').textContent = weekWorkouts;
    document.getElementById('workout-streak').textContent = `${streak} days`;
}

// Workout template functions
async function loadWorkoutTemplates() {
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/workouts/templates`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayWorkoutTemplates(data.templates);
        } else {
            showToast('Failed to load templates', 'error');
        }
    } catch (error) {
        showToast('Network error loading templates', 'error');
    }
    
    hideLoading();
}

function displayWorkoutTemplates(templates) {
    const container = document.getElementById('templates-list');
    container.innerHTML = '';
    
    templates.forEach(template => {
        const templateCard = document.createElement('div');
        templateCard.className = 'template-card';
        templateCard.onclick = () => startWorkout(template);
        
        templateCard.innerHTML = `
            <h3>${template.name}</h3>
            <p>${template.description}</p>
            <ul class="template-exercises">
                ${template.exercises.map(ex => 
                    `<li>${ex.exercise.name} - ${ex.sets} sets x ${ex.reps_range} reps</li>`
                ).join('')}
            </ul>
            <button class="btn-primary" onclick="event.stopPropagation(); startWorkout(${JSON.stringify(template).replace(/"/g, '&quot;')})">
                Start Workout
            </button>
        `;
        
        container.appendChild(templateCard);
    });
}

// Workout logging functions
function startWorkout(template) {
    currentWorkout = {
        template: template,
        startTime: new Date(),
        sets: []
    };
    
    workoutStartTime = Date.now();
    startWorkoutTimer();
    
    document.getElementById('current-workout-name').textContent = template.name;
    setupWorkoutExercises(template.exercises);
    showSection('workout-logging');
}

function startWorkoutTimer() {
    workoutTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('workout-timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function setupWorkoutExercises(exercises) {
    const container = document.getElementById('workout-exercises');
    container.innerHTML = '';
    
    exercises.forEach((templateExercise, exerciseIndex) => {
        const exerciseDiv = document.createElement('div');
        exerciseDiv.className = 'exercise-log';
        
        exerciseDiv.innerHTML = `
            <h4>${templateExercise.exercise.name}</h4>
            <div class="sets-container" id="sets-${exerciseIndex}">
                ${Array.from({length: templateExercise.sets}, (_, setIndex) => `
                    <div class="set-log">
                        <label>Set ${setIndex + 1}</label>
                        <input type="number" placeholder="Weight" id="weight-${exerciseIndex}-${setIndex}" min="0" step="0.5">
                        <input type="number" placeholder="Reps" id="reps-${exerciseIndex}-${setIndex}" min="1" required>
                        <input type="number" placeholder="RPE" id="rpe-${exerciseIndex}-${setIndex}" min="1" max="10">
                        <button type="button" onclick="logSet(${exerciseIndex}, ${setIndex}, ${templateExercise.exercise.id})" class="btn-secondary">✓</button>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.appendChild(exerciseDiv);
    });
}

function logSet(exerciseIndex, setIndex, exerciseId) {
    const weight = parseFloat(document.getElementById(`weight-${exerciseIndex}-${setIndex}`).value) || 0;
    const reps = parseInt(document.getElementById(`reps-${exerciseIndex}-${setIndex}`).value);
    const rpe = parseInt(document.getElementById(`rpe-${exerciseIndex}-${setIndex}`).value) || null;
    
    if (!reps) {
        showToast('Please enter number of reps', 'error');
        return;
    }
    
    const setData = {
        exercise_id: exerciseId,
        set_number: setIndex + 1,
        weight: weight,
        reps: reps,
        rpe: rpe
    };
    
    currentWorkout.sets.push(setData);
    
    // Mark set as completed visually
    const setElement = document.querySelector(`#weight-${exerciseIndex}-${setIndex}`).closest('.set-log');
    setElement.style.background = '#d4edda';
    setElement.querySelector('button').textContent = '✓';
    setElement.querySelector('button').disabled = true;
    
    showToast('Set logged!', 'success');
}

function cancelWorkout() {
    if (confirm('Are you sure you want to cancel this workout? All progress will be lost.')) {
        currentWorkout = null;
        if (workoutTimer) {
            clearInterval(workoutTimer);
            workoutTimer = null;
        }
        showDashboard();
    }
}

async function finishWorkout() {
    if (!currentWorkout || currentWorkout.sets.length === 0) {
        showToast('Please log at least one set before finishing', 'error');
        return;
    }
    
    showLoading();
    
    const duration = Math.floor((Date.now() - workoutStartTime) / 60000); // minutes
    
    try {
        const response = await fetch(`${API_BASE}/workouts/log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                template_id: currentWorkout.template.id,
                duration_minutes: duration,
                sets: currentWorkout.sets,
                notes: ''
            })
        });
        
        if (response.ok) {
            showToast('Workout completed successfully!', 'success');
            currentWorkout = null;
            if (workoutTimer) {
                clearInterval(workoutTimer);
                workoutTimer = null;
            }
            showDashboard();
            loadDashboardData(); // Refresh dashboard stats
        } else {
            const data = await response.json();
            showToast(data.error || 'Failed to save workout', 'error');
        }
    } catch (error) {
        showToast('Network error saving workout', 'error');
    }
    
    hideLoading();
}

// Workout history functions
async function loadWorkoutHistory() {
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/workouts/history`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayWorkoutHistory(data.workouts);
        } else {
            showToast('Failed to load workout history', 'error');
        }
    } catch (error) {
        showToast('Network error loading history', 'error');
    }
    
    hideLoading();
}

function displayWorkoutHistory(workouts) {
    const container = document.getElementById('history-list');
    container.innerHTML = '';
    
    if (workouts.length === 0) {
        container.innerHTML = '<p>No workouts recorded yet. Start your first workout!</p>';
        return;
    }
    
    workouts.forEach(workout => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.onclick = () => showWorkoutDetails(workout);
        
        const workoutDate = new Date(workout.date).toLocaleDateString();
        const totalSets = workout.sets.length;
        const exercises = [...new Set(workout.sets.map(s => s.exercise.name))];
        
        historyItem.innerHTML = `
            <div class="history-header">
                <h4>${workout.template ? workout.template.name : 'Custom Workout'}</h4>
                <span class="history-date">${workoutDate}</span>
            </div>
            <div class="history-summary">
                ${exercises.length} exercises • ${totalSets} sets • ${workout.duration_minutes || 0} minutes
            </div>
        `;
        
        container.appendChild(historyItem);
    });
}

function showWorkoutDetails(workout) {
    alert(`Workout Details:\n\nDate: ${new Date(workout.date).toLocaleDateString()}\nDuration: ${workout.duration_minutes || 0} minutes\nSets: ${workout.sets.length}\n\nExercises:\n${workout.sets.map(s => `${s.exercise.name}: ${s.reps} reps @ ${s.weight || 'bodyweight'}${s.rpe ? ` (RPE: ${s.rpe})` : ''}`).join('\n')}`);
}

// Utility functions
function showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.getElementById('toast-container').appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}
