# Featherlite: Professional Wardrobe Care

**"Pristine Care, Professional Finish"**

Featherlite Laundry Studio is a premium laundry and dry cleaning flagship that combines high-end garment care with state-of-the-art interactive technology. We provide a seamless experience for your wardrobe, from 3D restoration previews to AI-powered pickup scheduling.

## 🚀 Key Features

- **3D Experience Studio**: Interact with high-fidelity 3D models of sneakers, curtains, and carpets to preview restoration results.
- **Machinery Zoom Parallax**: A cinematic look into our professional machinery with interactive zoom effects on the About page.
- **SaaS Pickup Scheduling**: Secure, authenticated booking flow with real-time slot validation based on local timezone and capacity.
- **Custom Video Tour**: Integrated machinery and workplace showcase with a premium custom-built media player.
- **Modern Dark UI**: A high-performance, dark-themed frontend built with GSAP and Lenis for smooth scrolling and micro-animations.

## 🛠 Tech Stack

- **Backend**: [Flask](https://flask.palletsprojects.com/) (Python)
- **Database**: [SQLAlchemy](https://www.sqlalchemy.org/) with SQLite
- **Authentication**: [Flask-Login](https://flask-login.readthedocs.io/)
- **Frontend**: HTML5, Vanilla CSS3, JavaScript (ES6+)
- **Animations**: [GSAP](https://greensock.com/gsap/) & [ScrollTrigger](https://greensock.com/scrolltrigger/)
- **Smooth Scrolling**: [Lenis](https://lenis.darkroom.engineering/)
- **3D Rendering**: [Three.js](https://threejs.org/)

## 📦 Project Structure

```text
├── app.py              # Main Flask application and API routes
├── models.py           # SQLAlchemy database models
├── instance/           # Local SQLite database
├── static/
│   ├── css/            # Custom CSS modules
│   ├── js/             # Frontend logic & 3D scene Code
│   ├── models/         # 3D .glb assets
│   └── images/         # Branding and Machinery assets
├── templates/          # Jinja2 HTML templates
└── requirements.txt    # Project dependencies
```

## 📄 License

This project is licensed under the MIT License - see the `LICENSE` file for details.

---
*Built with ❤️ for Professional Garment Care.*
