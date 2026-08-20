import os
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

def generate_pdf(data: dict, output_filename: str):
    """
    Renders an HTML template with Jinja2 using provided LLM JSON data,
    and then converts the HTML to a PDF using WeasyPrint.
    """
    # Setup Jinja environment
    template_dir = os.path.join(os.path.dirname(__file__), 'templates')
    env = Environment(loader=FileSystemLoader(template_dir))
    template = env.get_template('report.html')

    # Render HTML string
    html_out = template.render(**data)

    # Output paths
    output_path = os.path.join(os.path.dirname(__file__), output_filename)
    
    # Generate PDF
    HTML(string=html_out).write_pdf(output_path)
    print(f"Generated PDF successfully at: {output_path}")
    return output_path
