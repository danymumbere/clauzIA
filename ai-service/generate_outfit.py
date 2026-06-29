from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from PIL import Image, ImageOps, ImageDraw, ImageFont
from io import BytesIO
import requests

app = Flask(__name__)
CORS(app)

def download_image(url):
    response = requests.get(url, timeout=20)
    response.raise_for_status()
    return Image.open(BytesIO(response.content)).convert("RGBA")

def fit_image(img, size):
    return ImageOps.contain(img, size)

def draw_label(draw, x, y, text):
    draw.text((x, y), text, fill=(30, 30, 30, 255))

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "ClauzIA AI service is running"})

@app.route("/generate-outfit", methods=["POST"])
def generate_outfit():
    try:
        data = request.get_json(force=True)

        user_photo_url = data.get("userPhotoUrl")
        garments = data.get("garments", [])

        if not user_photo_url:
            return jsonify({"error": "userPhotoUrl manquant"}), 400

        # Canvas de démonstration propre
        canvas = Image.new("RGBA", (1400, 1000), (246, 240, 234, 255))
        draw = ImageDraw.Draw(canvas)

        # Titre
        draw.text((60, 30), "ClauzIA - Aperçu de tenue", fill=(20, 20, 20, 255))

        # Photo utilisateur
        user_img = download_image(user_photo_url)
        user_box = fit_image(user_img, (560, 860))
        user_bg = Image.new("RGBA", (580, 880), (255, 255, 255, 255))
        user_bg.paste(user_box, ((580 - user_box.width) // 2, (880 - user_box.height) // 2), user_box)
        canvas.paste(user_bg, (50, 90), user_bg)

        draw_label(draw, 60, 980 - 35, "Photo utilisateur")

        # Panneau vêtements
        panel_x = 670
        panel_y = 90
        card_w = 670
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
                    gfit = fit_image(gimg, (160, 140))
                    thumb_bg = Image.new("RGBA", (180, 160), (250, 250, 250, 255))
                    thumb_bg.paste(gfit, ((180 - gfit.width) // 2, (160 - gfit.height) // 2), gfit)
                    card.paste(thumb_bg, (20, 30), thumb_bg)

                    category = garment.get("category", "").strip() or "Vêtement"
                    card_draw.text((230, 70), f"Catégorie : {category}", fill=(40, 40, 40, 255))
                    card_draw.text((230, 105), f"Placement : {placement_labels[placement]}", fill=(80, 80, 80, 255))
                except Exception:
                    card_draw.text((230, 70), "Image indisponible", fill=(150, 50, 50, 255))
            else:
                card_draw.text((230, 80), "Aucun vêtement sélectionné", fill=(120, 120, 120, 255))

            canvas.paste(card, (panel_x, y), card)

        out = BytesIO()
        canvas.convert("RGB").save(out, format="PNG")
        out.seek(0)

        return send_file(out, mimetype="image/png")

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)