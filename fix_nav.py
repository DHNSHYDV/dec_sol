import re

# Read landing_v2.html to extract parts
with open('templates/landing_v2.html', 'r') as f:
    landing = f.readlines()

# Extract parts
nav_css = "".join(landing[72:337])
nav_html = "".join(landing[1631:1716])
nav_js = "".join(landing[2781:2810])

# Fix active states in HTML for about.html
# In landing_v2, nothing has .active initially but About us shouldn't be a # link.
# Since we are in about.html, "Home" should go to url_for('landing_v2') and "About" should just have the active highlight.
nav_html = nav_html.replace('href="#home"', 'href="{{ url_for(\'landing_v2\') }}"')
nav_html = nav_html.replace('href="#services"', 'href="{{ url_for(\'landing_v2\') }}#services"')
nav_html = nav_html.replace('href="#contact"', 'href="{{ url_for(\'landing_v2\') }}#contact"')
# Make About visually active in the new glass-nav if possible by adding a style or class? 
# In about.html's current nav, "About us" had: style="color: white; background: rgba(255,255,255,0.1);"
nav_html = nav_html.replace(
    '<a href="{{ url_for(\'about\') }}" class="nav-item">',
    '<a href="#" class="nav-item" style="color: white; background: rgba(255,255,255,0.1);">'
)

# Read about.html
with open('templates/about.html', 'r') as f:
    about = f.read()

# Replace CSS
# about.html CSS nav block is from /* Nav Minimal Clone */ to /* About specific CSS
about_css_pattern = re.compile(r'/\* Nav Minimal Clone \*/.*?/\* About specific CSS extracted from landing_v2\.html \*/', re.DOTALL)
about = about_css_pattern.sub(nav_css + '\n        /* About specific CSS extracted from landing_v2.html */', about)

# Replace HTML
# about.html HTML nav block is from <!-- Simplified Navigation --> to <!-- About Section -->
about_html_pattern = re.compile(r'<!-- Simplified Navigation -->.*?<!-- About Section -->', re.DOTALL)
about = about_html_pattern.sub(nav_html + '\n\n    <!-- About Section -->', about)

# Insert JS before </script>
about = about.replace('</script>', nav_js + '\n    </script>')

# Remove old media query in about.html that hides nav-links
about = re.sub(r'\.nav-links \{\s*display: none;\s*/\* simple nav for mobile \*/\s*\}', '', about)

with open('templates/about.html', 'w') as f:
    f.write(about)

print("Done porting nav.")
