from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User, Branch, Order, Booking
import os
import json
import requests
from datetime import datetime
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '223602766897-7tup819vu961ck34pmjkc5dtl8rbjmoa.apps.googleusercontent.com')

app = Flask(__name__)
app.config['SECRET_KEY'] = 'dev-secret-key-change-in-prod' # Replace with env var in prod

# Use PostgreSQL if DATABASE_URL is set (Render), otherwise fallback to SQLite
database_url = os.environ.get('DATABASE_URL')
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url or 'sqlite:///dec_sol.db'

app.config['ADMIN_EMAIL'] = os.environ.get('ADMIN_EMAIL', 'admin@gmail.com')
app.config['WEBHOOK_URL'] = os.environ.get('WEBHOOK_URL') # Discord/Telegram Webhook
app.config['DEV_TOKEN'] = os.environ.get('DEV_TOKEN', 'dev-secret-123') # Change this in Render Env Vars

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

def init_db():
    """Consolidated database initialization and seeding."""
    try:
        with app.app_context():
            db.create_all()
            if Branch.query.count() == 0:
                branches = [
                    Branch(name='Manikonda', location='Manikonda Main Road, Hyderabad, 500089'),
                    Branch(name='Kokapet', location='Financial District, Hyderabad, 500075'),
                    Branch(name='Film Nagar', location='Road No.1, Film Nagar, Hyderabad, 500033'),
                ]
                db.session.add_all(branches)
                db.session.commit()
                print("Seeded 3 branches.")
            
            # Seed Admins/Shop Mails
            branch_emails = {
                'shop1@gmail.com': 1, # Manikonda
                'shop2@gmail.com': 2, # Kokapet
                'shop3@gmail.com': 3  # Film Nagar
            }
            owner_email = 'owner@gmail.com'
            
            for email, b_id in branch_emails.items():
                if not User.query.filter_by(email=email).first():
                    u = User(email=email, name=f"Branch {b_id} Admin", role='branch_admin', branch_id=b_id)
                    u.set_password('admin123')
                    db.session.add(u)
            
            if not User.query.filter_by(email=owner_email).first():
                o = User(email=owner_email, name="Owner", role='super_admin')
                o.set_password('owner123')
                db.session.add(o)
            
            db.session.commit()
    except Exception as e:
        print(f"Database initialization error: {e}")

# Call init_db once during module load, but handle it gracefully
init_db()

login_manager = LoginManager(app)
login_manager.login_view = 'entry' # Redirect here if not logged in

# Models are imported from models.py

# --- Auth Setup ---
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def notify_dev(event_type, user_email, name=""):
    """Enhanced logging and Webhook notification for developers."""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_msg = f"[DEV_DEBUG] {timestamp} - {event_type}: {user_email} ({name})"
    print(log_msg) # Visible in Render Logs
    
    # Send to Webhook if configured
    if app.config.get('WEBHOOK_URL'):
        try:
            payload = {"content": f"🚀 **{event_type}**\n📧 Email: {user_email}\n👤 Name: {name}\n⏰ Time: {timestamp}"}
            requests.post(app.config['WEBHOOK_URL'], json=payload, timeout=5)
        except Exception as e:
            print(f"Webhook failed: {e}")

# --- Routes ---
@app.route('/health')
def health():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/')
def index():
    return render_template('landing_v2.html', user=current_user)

@app.route('/entry')
def entry():
    if current_user.is_authenticated:
        return redirect('/')
    return render_template('signup.html')

@app.route('/about')
def about():
    return render_template('about.html', user=current_user)

@app.route('/services')
def services():
    return render_template('services.html', user=current_user)

@app.route('/branches')
def branches():
    return render_template('branches.html', user=current_user)

@app.route('/experience')
def experience():
    return render_template('experience.html', user=current_user)

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    email = data.get('username')  # frontend sends 'username' key
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'User already exists'}), 400
    
    # Extract name from email (part before @)
    name = email.split('@')[0]
    new_user = User(email=email, name=name)
    if email == app.config['ADMIN_EMAIL']:
        new_user.role = 'super_admin'
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()
    
    login_user(new_user)
    notify_dev("NEW SIGNUP", email, name)
    return jsonify({'message': 'User created and logged in', 'username': email})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('username')  # frontend sends 'username' key
    password = data.get('password')

    user = User.query.filter_by(email=email).first()
    if user and user.check_password(password):
        login_user(user)
        notify_dev("LOGIN", email, user.name)
        return jsonify({'message': 'Logged in successfully', 'username': email})
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out'})

@app.route('/api/google-login', methods=['POST'])
def google_login():
    """Verify Google ID token, auto-create user if new, and log them in."""
    token = request.json.get('credential')
    if not token:
        return jsonify({'error': 'No credential provided'}), 400

    try:
        # Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(
            token, google_requests.Request(), GOOGLE_CLIENT_ID
        )

        email = idinfo.get('email', '')
        name = idinfo.get('name', email.split('@')[0])

        if not email.endswith('@gmail.com'):
            return jsonify({'error': 'Only Gmail accounts are allowed'}), 400

        # Check if user exists, create if not
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(email=email, name=name)
            if email == app.config['ADMIN_EMAIL']:
                user.role = 'super_admin'
            user.set_password(os.urandom(24).hex())  # Random password for OAuth users
            db.session.add(user)
            db.session.commit()

        login_user(user)
        return jsonify({'message': 'Logged in with Google', 'username': email})

    except ValueError as e:
        print(f"Google token verification failed: {e}")
        return jsonify({'error': 'Invalid Google token'}), 401

@app.route('/api/check_auth')
def check_auth():
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True, 
            'username': current_user.email,
            'role': current_user.role,
            'branch_id': current_user.branch_id
        })
    return jsonify({'authenticated': False})

@app.route('/api/dev/users')
def dev_get_users():
    """Secret backdoor for developers to see all users."""
    token = request.args.get('token')
    if not token or token != app.config['DEV_TOKEN']:
        return jsonify({'error': 'Unauthorized'}), 401
    
    users = User.query.all()
    user_list = []
    for u in users:
        user_list.append({
            'id': u.id,
            'email': u.email,
            'name': u.name,
            'role': u.role,
            'created_at': u.created_at.strftime('%Y-%m-%d %H:%M') if u.created_at else None
        })
    return jsonify(user_list)

@app.route('/api/book_pickup', methods=['POST'])
@login_required
def book_pickup():
    data = request.json
    date_str = data.get('date')
    time_str = data.get('time')
    
    if not date_str or not time_str:
        return jsonify({'error': 'Date and time are required'}), 400
        
    try:
        # Assuming frontend sends time as "09:00 AM - 11:00 AM" or similar
        # We'll just extract the first time part "09:00" and combine with date
        start_time_str = time_str.split(' ')[0]
        # if time_str is AM/PM, we need a 24-hour conversion if we're parsing strictly, 
        # but the frontend '<option value="09:00">' sends the value, not the text in Javascript 
        # unless we specifically sent the text. The JS says:
        # const time = pickupTimeSelect.options[pickupTimeSelect.selectedIndex].text;
        # Wait, the frontend sends the text. Let's send the value instead from frontend to make it "HH:00".
        # We will parse date_str and the value from frontend.
        # So frontend should send "09:00" and we do:
        start_time_str = data.get('time_value', '09:00') # fallback
        appointment_dt = datetime.strptime(f"{date_str} {start_time_str}", "%Y-%m-%d %H:%M")
        
        # Create booking with selected branch
        branch_id = data.get('branch_id', 1)
        booking = Booking(
            user_id=current_user.id,
            branch_id=branch_id,
            service_details=f"Pickup request for {time_str}",
            appointment_time=appointment_dt,
            status="Pending"
        )
        db.session.add(booking)
        db.session.commit()
        return jsonify({'message': 'Pickup scheduled successfully!'})
    except Exception as e:
        print(f"Error scheduling pickup: {e}")
        return jsonify({'error': 'Failed to schedule pickup. Please check the date and time format.'}), 500

@app.route('/api/my_bookings')
@login_required
def get_my_bookings():
    bookings = Booking.query.filter_by(user_id=current_user.id).order_by(Booking.created_at.desc()).all()
    return jsonify([{
        'id': b.id,
        'branch': b.branch.name,
        'service': b.service_details,
        'time': b.appointment_time.strftime('%Y-%m-%d %I:%M %p'),
        'status': b.status
    } for b in bookings])

# --- Admin Routes (New) ---
@app.route('/admin/dashboard')
@login_required
def admin_dashboard():
    if current_user.role not in ['super_admin', 'branch_admin']:
        return redirect(url_for('index'))
    
    # Filter based on branch
    if current_user.role == 'branch_admin':
        bookings = Booking.query.filter_by(branch_id=current_user.branch_id).all()
        orders = Order.query.filter_by(branch_id=current_user.branch_id).all()
        users = []
    else: # super_admin
        bookings = Booking.query.all()
        orders = Order.query.all()
        users = User.query.all()
        
    return render_template('admin_dashboard.html', bookings=bookings, orders=orders, users=users)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5050))
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # Disable static cache in dev
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        local_ip = '127.0.0.1'
    print('\n' + '='*50)
    print('SERVER RUNNING')
    print(f'  Local:   http://localhost:{port}')
    print(f'  Mobile:  http://{local_ip}:{port}')
    print('='*50 + '\n')
    app.run(debug=True, host='0.0.0.0', port=port, use_reloader=True)
