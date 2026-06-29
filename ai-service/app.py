from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from rembg import remove
from PIL import Image, ImageOps, ImageDraw
from io import BytesIO
import requests
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

OUTPUT_DIR = "outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def download_image(url):
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return Image.open(BytesIO(response.content)).convert("RGBA")

def fit_image(img, size):
    return ImageOps.contain(img, size)

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "ClauzIA AI service is running"})

@app.route("/remove-background", methods=["POST"])
def remove_background():
    try:
        if "image" not in request.files:
            return jsonify({"error": "Aucune image envoyée"}), 400

        file = request.files["image"]
        input_bytes = file.read()
        output_bytes = remove(input_bytes)

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        output_filename = f"processed_{timestamp}.png"
        output_path = os.path.join(OUTPUT_DIR, output_filename)

        with open(output_path, "wb") as f:
            f.write(output_bytes)

        return send_file(output_path, mimetype="image/png", as_attachment=False)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/generate-outfit-intelligent", methods=["POST"])
def generate_outfit_intelligent():
    try:
        data = request.get_json(force=True)

        user_info = data.get("user", {})
        context = data.get("context", {})
        garments = data.get("garments", [])

        user_photo_url = user_info.get("photoUrl")

        if not user_photo_url:
            return jsonify({"error": "Photo utilisateur manquante"}), 400

        # Canvas principal
        canvas = Image.new("RGBA", (1600, 1000), (246, 240, 234, 255))
        draw = ImageDraw.Draw(canvas)

        # Titre
        draw.text((60, 30), "ClauzIA - Génération intelligente de tenue", fill=(20, 20, 20, 255))
        draw.text(
            (60, 65),
            f"Humeur: {context.get('mood', '-') } | Occasion: {context.get('occasion', '-') } | Saison: {context.get('season', '-') }",
            fill=(60, 60, 60, 255)
        )

        # Photo complète de l'utilisateur = entrée principale
        user_img = download_image(user_photo_url)
        user_fit = fit_image(user_img, (600, 860))

        user_box = Image.new("RGBA", (640, 900), (255, 255, 255, 255))
        user_draw = ImageDraw.Draw(user_box)
        user_box.paste(user_fit, ((640 - user_fit.width) // 2, 40), user_fit)
        user_draw.rounded_rectangle([0, 0, 639, 899], radius=20, outline=(230, 230, 230, 255), width=2)
        user_draw.text((24, 16), "Photo complète de l'utilisateur", fill=(20, 20, 20, 255))
        user_draw.text((24, 840), "Entrée principale pour le futur VTON", fill=(90, 90, 90, 255))

        canvas.paste(user_box, (50, 90), user_box)

        # Panneau des vêtements à droite
        panel_x = 740
        panel_y = 90
        card_w = 810
        card_h = 200
        gap = 20

        placements_order = ["top", "bottom", "shoes", "accessory"]
        placement_labels = {
            "top": "Haut",
            "bottom": "Bas",
            "shoes": "Chaussures",
            "accessory": "Accessoire",
        }

        garments_map = {g.get("placement"): g for g in garments if g.get("placement") in placements_order}

        for idx, placement in enumerate(placements_order):
            y = panel_y + idx * (card_h + gap)

            card = Image.new("RGBA", (card_w, card_h), (255, 255, 255, 255))
            card_draw = ImageDraw.Draw(card)
            card_draw.rounded_rectangle([0, 0, card_w - 1, card_h - 1], radius=18, outline=(230, 230, 230, 255), width=2)
            card_draw.text((20, 16), placement_labels[placement], fill=(20, 20, 20, 255))

            garment = garments_map.get(placement)

            if garment and garment.get("imageUrl"):
                try:
                    gimg = download_image(garment["imageUrl"])
                    gfit = fit_image(gimg, (170, 150))
                    thumb_bg = Image.new("RGBA", (190, 170), (250, 250, 250, 255))
                    thumb_bg.paste(gfit, ((190 - gfit.width) // 2, (170 - gfit.height) // 2), gfit)
                    card.paste(thumb_bg, (20, 18), thumb_bg)

                    category = garment.get("category", "").strip() or "Vêtement"
                    card_draw.text((240, 68), f"Catégorie : {category}", fill=(40, 40, 40, 255))
                    card_draw.text((240, 104), f"Placement : {placement_labels[placement]}", fill=(80, 80, 80, 255))
                except Exception:
                    card_draw.text((240, 82), "Image indisponible", fill=(150, 50, 50, 255))
            else:
                card_draw.text((240, 82), "Aucun vêtement sélectionné", fill=(120, 120, 120, 255))

            canvas.paste(card, (panel_x, y), card)

        out = BytesIO()
        canvas.convert("RGB").save(out, format="PNG")
        out.seek(0)

        return send_file(out, mimetype="image/png")

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)