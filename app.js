// Global state
let currentUser = null;
let authToken = null;
let currentWorkout = null;
let workoutTimer = null;
let workoutStartTime = null;

// API base URL
const API_BASE = 'http://localhost:5000/api';
// Development flag to enable frontend-only fallbacks when backend is unavailable
const IS_DEV = true;

// Local storage helpers (development fallback, per-account)
function getLocalWorkoutHistoryMap() {
	try {
		return JSON.parse(localStorage.getItem('workoutHistoryByUser') || '{}');
	} catch (e) {
		return {};
	}
}

function saveLocalWorkoutHistoryMap(map) {
	localStorage.setItem('workoutHistoryByUser', JSON.stringify(map));
}

function getLocalWorkoutHistory(email) {
	if (!email) return [];
	const map = getLocalWorkoutHistoryMap();
	return map[email] || [];
}

function saveLocalWorkoutHistory(email, history) {
	if (!email) return;
	const map = getLocalWorkoutHistoryMap();
	map[email] = history;
	saveLocalWorkoutHistoryMap(map);
}

// Profile persistence helpers (per-account, keyed by email)
function getLocalUserProfiles() {
	try {
		return JSON.parse(localStorage.getItem('userProfiles') || '{}');
	} catch (e) {
		return {};
	}
}

function saveLocalUserProfiles(profiles) {
	localStorage.setItem('userProfiles', JSON.stringify(profiles));
}

function getLocalUserProfile(email) {
	if (!email) return null;
	const profiles = getLocalUserProfiles();
	return profiles[email] || null;
}

function saveLocalUserProfile(email, profile) {
	if (!email) return;
	const profiles = getLocalUserProfiles();
	profiles[email] = { ...(profiles[email] || {}), ...profile };
	saveLocalUserProfiles(profiles);
}

// Utilities to normalize and prefill onboarding form
function toArray(value) {
	if (!value) return [];
	if (Array.isArray(value)) return value;
	try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function getEffectiveProfile() {
	const email = currentUser && currentUser.email;
	const local = email ? getLocalUserProfile(email) : null;
	return {
		goals: toArray(local?.goals ?? currentUser?.goals),
		schedule: (local?.schedule ?? currentUser?.schedule) || '',
		equipment: toArray(local?.equipment ?? currentUser?.equipment),
		experience_level: (local?.experience_level ?? currentUser?.experience_level) || '',
		onboarding_completed: !!(local?.onboarding_completed ?? currentUser?.onboarding_completed)
	};
}

function prefillOnboardingForm() {
	const profile = getEffectiveProfile();
	const form = document.getElementById('onboarding-form');
	if (!form) return;

	// Goals (first form-group)
	const formGroups = document.querySelectorAll('#onboarding-form .form-group');
	if (formGroups[0]) {
		formGroups[0].querySelectorAll('input[type="checkbox"]').forEach(cb => {
			cb.checked = profile.goals.includes(cb.value);
		});
	}

	// Schedule
	const scheduleSelect = document.getElementById('schedule');
	if (scheduleSelect && profile.schedule) {
		scheduleSelect.value = profile.schedule;
	}

	// Equipment (third form-group)
	if (formGroups[2]) {
		formGroups[2].querySelectorAll('input[type="checkbox"]').forEach(cb => {
			cb.checked = profile.equipment.includes(cb.value);
		});
	}

	// Experience level
	const expSelect = document.getElementById('experience-level');
	if (expSelect && profile.experience_level) {
		expSelect.value = profile.experience_level;
	}
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Start at login page, but if user exists and has completed onboarding, skip setup on subsequent logins
    authToken = null;
    try {
        const savedUser = JSON.parse(localStorage.getItem('user') || 'null');
        const savedProfile = savedUser ? getLocalUserProfile(savedUser.email) : null;
        if (savedUser) {
            // Merge any locally saved profile fields
            const merged = {
                ...savedUser,
                ...(savedProfile ? {
                    goals: savedUser.goals || JSON.stringify(savedProfile.goals || []),
                    schedule: savedUser.schedule || savedProfile.schedule,
                    equipment: savedUser.equipment || JSON.stringify(savedProfile.equipment || []),
                    experience_level: savedUser.experience_level || savedProfile.experience_level,
                    onboarding_completed: savedUser.onboarding_completed || !!savedProfile?.onboarding_completed
                } : {})
            };
            currentUser = merged;
            localStorage.setItem('user', JSON.stringify(currentUser));
        } else if (savedProfile) {
            currentUser = {
                id: 0,
                email: savedProfile.email || 'demo@local',
                name: 'Demo User',
                goals: JSON.stringify(savedProfile.goals || []),
                schedule: savedProfile.schedule,
                equipment: JSON.stringify(savedProfile.equipment || []),
                experience_level: savedProfile.experience_level,
                onboarding_completed: !!savedProfile.onboarding_completed
            };
            localStorage.setItem('user', JSON.stringify(currentUser));
        } else {
            currentUser = null;
        }
    } catch {
        currentUser = null;
    }
    showAuth();
    
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
            
            // Do not force onboarding; show app and allow Setup Profile button if needed
            // Merge any stored profile for this email and persist
            const stored = getLocalUserProfile(currentUser.email);
            if (stored) {
                currentUser = {
                    ...currentUser,
                    goals: currentUser.goals || JSON.stringify(stored.goals || []),
                    schedule: currentUser.schedule || stored.schedule,
                    equipment: currentUser.equipment || JSON.stringify(stored.equipment || []),
                    experience_level: currentUser.experience_level || stored.experience_level,
                    onboarding_completed: currentUser.onboarding_completed || !!stored.onboarding_completed
                };
                localStorage.setItem('user', JSON.stringify(currentUser));
            }
            showApp();
            
            showToast('Login successful!', 'success');
        } else {
            if (IS_DEV) {
                // Dev fallback: prefer profile keyed by the email entered
                const profiles = getLocalUserProfiles();
                const attemptedEmail = email || Object.keys(profiles)[0] || 'demo@local';
                const profile = getLocalUserProfile(attemptedEmail);
                currentUser = JSON.parse(localStorage.getItem('user') || 'null') || {
                    id: 0,
                    email: attemptedEmail,
                    name: 'Demo User',
                    onboarding_completed: !!(profile && profile.onboarding_completed)
                };
                if (profile) {
                    currentUser = {
                        ...currentUser,
                        goals: JSON.stringify(profile.goals || []),
                        schedule: profile.schedule,
                        equipment: JSON.stringify(profile.equipment || []),
                        experience_level: profile.experience_level
                    };
                }
                authToken = '';
                localStorage.setItem('user', JSON.stringify(currentUser));
                showApp();
                showToast('Logged in (Development Mode)', 'success');
            } else {
                showToast(data.error || 'Login failed', 'error');
            }
        }
    } catch (error) {
        if (IS_DEV) {
            const profiles = getLocalUserProfiles();
            const attemptedEmail = document.getElementById('login-email').value || Object.keys(profiles)[0] || 'demo@local';
            const profile = getLocalUserProfile(attemptedEmail);
            currentUser = JSON.parse(localStorage.getItem('user') || 'null') || {
                id: 0,
                email: attemptedEmail,
                name: 'Demo User',
                onboarding_completed: !!(profile && profile.onboarding_completed)
            };
            if (profile) {
                currentUser = {
                    ...currentUser,
                    goals: JSON.stringify(profile.goals || []),
                    schedule: profile.schedule,
                    equipment: JSON.stringify(profile.equipment || []),
                    experience_level: profile.experience_level
                };
            }
            authToken = '';
            localStorage.setItem('user', JSON.stringify(currentUser));
            showApp();
            showToast('Logged in (Development Mode)', 'success');
        } else {
            showToast('Network error. Please try again.', 'error');
        }
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
    
    // Get all form groups
    const formGroups = document.querySelectorAll('#onboarding-form .form-group');
    
    // Goals are in the first form group
    const goals = Array.from(formGroups[0].querySelectorAll('input[type="checkbox"]:checked'))
                      .map(cb => cb.value);
    
    const schedule = document.getElementById('schedule').value;
    
    // Equipment is in the third form group (index 2)
    const equipment = Array.from(formGroups[2].querySelectorAll('input[type="checkbox"]:checked'))
                           .map(cb => cb.value);
    const experienceLevel = document.getElementById('experience-level').value;
    
    try {
        // Add timeout to prevent infinite loading
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
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
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            // Also store a compact profile for dev persistence
            saveLocalUserProfile(currentUser.email, {
                goals,
                schedule,
                equipment,
                experience_level: experienceLevel,
                onboarding_completed: true
            });
            
            showApp();
            showToast('Profile setup complete!', 'success');
        } else {
            // Fallback to local completion in development
            if (IS_DEV) {
                const profile = {
                    ...currentUser,
                    goals: JSON.stringify(goals),
                    schedule: schedule,
                    equipment: JSON.stringify(equipment),
                    experience_level: experienceLevel,
                    onboarding_completed: true
                };
                currentUser = profile;
                localStorage.setItem('user', JSON.stringify(currentUser));
                saveLocalUserProfile(currentUser.email, {
                    goals,
                    schedule,
                    equipment,
                    experience_level: experienceLevel,
                    onboarding_completed: true
                });
                showApp();
                showToast('Profile setup complete! (Saved locally)', 'success');
            } else {
                showToast(data.error || 'Setup failed', 'error');
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            showToast('Request timed out. The server may not be running.', 'error');
        } else if (error.message.includes('Failed to fetch')) {
            if (IS_DEV) {
                const profile = {
                    ...currentUser,
                    goals: JSON.stringify(goals),
                    schedule: schedule,
                    equipment: JSON.stringify(equipment),
                    experience_level: experienceLevel,
                    onboarding_completed: true
                };
                currentUser = profile;
                localStorage.setItem('user', JSON.stringify(currentUser));
                saveLocalUserProfile(currentUser.email, {
                    goals,
                    schedule,
                    equipment,
                    experience_level: experienceLevel,
                    onboarding_completed: true
                });
                showApp();
                showToast('Profile setup complete! (Saved locally)', 'success');
            } else {
                showToast('Cannot connect to server. Please ensure the backend is running on port 5000.', 'error');
            }
        } else {
            showToast('Network error. Please try again.', 'error');
        }
        console.error('Onboarding error:', error);
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
    // Prefill form from saved profile/user
    try { prefillOnboardingForm(); } catch {}
}

function showApp() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('onboarding-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'block';
    document.getElementById('navbar').style.display = 'block';
    
    // Toggle Setup Profile button based on onboarding completion
    const setupBtn = document.getElementById('setup-profile-btn');
    if (setupBtn) setupBtn.style.display = 'inline-block';

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
        // In development, always use locally saved workouts for dashboard stats
        if (IS_DEV) {
            const email = (currentUser && currentUser.email) || 'demo@local';
            updateDashboardStats(getLocalWorkoutHistory(email));
            return;
        }
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
        // Frontend-only fallback in development
        if (IS_DEV && !authToken) {
            const mockTemplates = [
                {
                    id: 1,
                    isMock: true,
                    name: 'Push/Pull/Legs',
                    description: 'A 3-day split focusing on push, pull and legs',
                    exercises: [
                        { exercise: { id: 101, name: 'Bench Press' }, sets: 4, reps_range: '6-8', order: 1 },
                        { exercise: { id: 102, name: 'Overhead Press' }, sets: 3, reps_range: '8-10', order: 2 },
                        { exercise: { id: 103, name: 'Incline Dumbbell Press' }, sets: 3, reps_range: '10-12', order: 3 },
                        { exercise: { id: 104, name: 'Dips' }, sets: 3, reps_range: '12-15', order: 4 }
                    ]
                },
                {
                    id: 2,
                    isMock: true,
                    name: 'Upper/Lower',
                    description: 'A 2-day split alternating upper and lower body',
                    exercises: [
                        { exercise: { id: 201, name: 'Barbell Rows' }, sets: 4, reps_range: '6-8', order: 1 },
                        { exercise: { id: 202, name: 'Pull-ups' }, sets: 3, reps_range: '8-12', order: 2 },
                        { exercise: { id: 203, name: 'Squats' }, sets: 4, reps_range: '5-8', order: 3 },
                        { exercise: { id: 204, name: 'Romanian Deadlifts' }, sets: 3, reps_range: '6-10', order: 4 }
                    ]
                }
            ];
            displayWorkoutTemplates(mockTemplates);
            hideLoading();
            return;
        }

        const response = await fetch(`${API_BASE}/workouts/templates`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayWorkoutTemplates(data.templates);
        } else {
            if (IS_DEV) {
                const fallbackTemplates = [
                    {
                        id: 3,
                        isMock: true,
                        name: 'Full Body Beginner',
                        description: 'Simple full-body routine to get started',
                        exercises: [
                            { exercise: { id: 301, name: 'Goblet Squat' }, sets: 3, reps_range: '8-12', order: 1 },
                            { exercise: { id: 302, name: 'Push-ups' }, sets: 3, reps_range: '8-15', order: 2 },
                            { exercise: { id: 303, name: 'Bent-over Row' }, sets: 3, reps_range: '8-12', order: 3 }
                        ]
                    }
                ];
                displayWorkoutTemplates(fallbackTemplates);
                hideLoading();
            } else {
                showToast('Failed to load templates', 'error');
            }
        }
    } catch (error) {
        if (IS_DEV) {
            const offlineTemplates = [
                {
                    id: 4,
                    isMock: true,
                    name: 'At-Home No Equipment',
                    description: 'Bodyweight-only routine for home',
                    exercises: [
                        { exercise: { id: 401, name: 'Bodyweight Squat' }, sets: 3, reps_range: '12-20', order: 1 },
                        { exercise: { id: 402, name: 'Push-ups' }, sets: 3, reps_range: '8-20', order: 2 },
                        { exercise: { id: 403, name: 'Plank' }, sets: 3, reps_range: '30-60s', order: 3 }
                    ]
                }
            ];
            displayWorkoutTemplates(offlineTemplates);
            hideLoading();
        } else {
            showToast('Network error loading templates', 'error');
        }
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
    
    // Dev fallback: save locally when backend/auth not available
    if (IS_DEV && (!authToken || authToken === '' || (currentWorkout.template && currentWorkout.template.isMock))) {
        const workout = {
            id: Date.now(),
            template: currentWorkout.template,
            date: new Date().toISOString(),
            duration_minutes: duration,
            notes: '',
            sets: currentWorkout.sets.map(s => {
                const match = (currentWorkout.template.exercises || []).find(te => te.exercise && te.exercise.id === s.exercise_id);
                return {
                    ...s,
                    exercise: match ? match.exercise : { id: s.exercise_id, name: 'Exercise' }
                };
            })
        };
        const email = (currentUser && currentUser.email) || 'demo@local';
        const history = getLocalWorkoutHistory(email);
        history.unshift(workout);
        saveLocalWorkoutHistory(email, history);
        
        showToast('Workout completed successfully! (Saved locally)', 'success');
        currentWorkout = null;
        if (workoutTimer) {
            clearInterval(workoutTimer);
            workoutTimer = null;
        }
        showDashboard();
        updateDashboardStats(history);
        hideLoading();
        return;
    }

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
        // In development, always load history from local storage
        if (IS_DEV) {
            const email = (currentUser && currentUser.email) || 'demo@local';
            displayWorkoutHistory(getLocalWorkoutHistory(email));
            hideLoading();
            return;
        }
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
