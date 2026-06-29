// À la place de : const API_BASE = "http://localhost:5000";
const API_BASE = window.location.origin;

  let currentEditingGarmentId = null;
  let currentGeneratedImageUrl = null;
  let lastPreviewObjectUrls = [];

  function showMessage(elementId, message, type = "success") {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = message;
    el.className = `message ${type}`;
  }

  function getStoredUser() {
    try {
      const raw = localStorage.getItem("clauzia_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getToken() {
    return localStorage.getItem("clauzia_token");
  }

  function redirectIfNotLoggedIn() {
    if (!getToken()) {
      window.location.href = "login.html";
    }
  }

  function setupSingleChoiceChips(groupId, inputId) {
    const group = document.getElementById(groupId);
    const input = document.getElementById(inputId);
    if (!group || !input) return;

    const chips = Array.from(group.querySelectorAll(".chip"));

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const value = chip.dataset.value || "";
        input.value = value;

        chips.forEach((c) => {
          c.classList.toggle("active", c === chip);
        });
      });
    });
  }

  function setupMultiChoiceChips(groupId, inputId) {
    const group = document.getElementById(groupId);
    const input = document.getElementById(inputId);
    if (!group || !input) return;

    const chips = Array.from(group.querySelectorAll(".chip"));
    let selected = [];

    const sync = () => {
      input.value = selected.join(", ");
      chips.forEach((chip) => {
        chip.classList.toggle("active", selected.includes(chip.dataset.value));
      });
    };

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const value = chip.dataset.value || "";
        if (!value) return;

        if (selected.includes(value)) {
          selected = selected.filter((item) => item !== value);
        } else {
          selected.push(value);
        }

        sync();
      });
    });

    sync();
  }

  function setSingleChoiceValue(groupId, inputId, value) {
    const group = document.getElementById(groupId);
    const input = document.getElementById(inputId);
    if (!group || !input) return;

    input.value = value || "";
    group.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.value === value);
    });
  }

  function setMultiChoiceValues(groupId, inputId, values) {
    const group = document.getElementById(groupId);
    const input = document.getElementById(inputId);
    if (!group || !input) return;

    const arr = Array.isArray(values) ? values : [];
    input.value = arr.join(", ");

    group.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.toggle("active", arr.includes(chip.dataset.value));
    });
  }

  function clearFileInputs(...inputIds) {
    inputIds.forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.value = "";
    });
  }

  function revokePreviewUrls() {
    lastPreviewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    lastPreviewObjectUrls = [];
  }

  function getFirstSelectedFile(...inputIds) {
    for (const id of inputIds) {
      const input = document.getElementById(id);
      if (input && input.files && input.files.length > 0) {
        return input.files[0];
      }
    }
    return null;
  }

  function bindCameraButtons(buttonId, inputId) {
    const button = document.getElementById(buttonId);
    const input = document.getElementById(inputId);

    if (!button || !input) return;

    button.addEventListener("click", () => {
      input.click();
    });
  }

  function setupPreviewFromInputs(previewId, ...inputIds) {
    const preview = document.getElementById(previewId);
    if (!preview) return;

    const updatePreview = () => {
      const file = getFirstSelectedFile(...inputIds);
      if (!file) {
        preview.src = "";
        preview.style.display = "none";
        return;
      }

      revokePreviewUrls();
      const objectUrl = URL.createObjectURL(file);
      lastPreviewObjectUrls.push(objectUrl);

      preview.src = objectUrl;
      preview.style.display = "block";
    };

    inputIds.forEach((id) => {
      const input = document.getElementById(id);
      if (!input) return;

      input.addEventListener("change", updatePreview);
    });
  }

  function resetGarmentForm() {
    currentEditingGarmentId = null;

    const garmentId = document.getElementById("garmentId");
    const submitBtn = document.getElementById("garmentSubmitBtn");
    const cancelBtn = document.getElementById("cancelGarmentEditBtn");
    const garmentForm = document.getElementById("garmentForm");
    const preview = document.getElementById("garmentPreview");

    if (garmentId) garmentId.value = "";
    if (submitBtn) submitBtn.textContent = "Ajouter le vêtement";
    if (cancelBtn) cancelBtn.style.display = "none";
    if (garmentForm) garmentForm.reset();

    if (preview) {
      preview.src = "";
      preview.style.display = "none";
    }

    [
      "placement",
      "category",
      "garmentSeason",
      "moodTags",
      "occasionTags",
      "currentGarmentImageUrl",
      "currentProcessedImageUrl",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    [
      "placementGroup",
      "categoryGroup",
      "garmentSeasonGroup",
      "moodTagsGroup",
      "occasionTagsGroup",
    ].forEach((groupId) => {
      const group = document.getElementById(groupId);
      if (group) {
        group.querySelectorAll(".chip").forEach((chip) => chip.classList.remove("active"));
      }
    });
  }

  function fillGarmentForm(garment) {
    currentEditingGarmentId = garment._id;

    const garmentId = document.getElementById("garmentId");
    const submitBtn = document.getElementById("garmentSubmitBtn");
    const cancelBtn = document.getElementById("cancelGarmentEditBtn");
    const preview = document.getElementById("garmentPreview");
    const currentImageUrl = document.getElementById("currentGarmentImageUrl");
    const currentProcessedImageUrl = document.getElementById("currentProcessedImageUrl");

    if (garmentId) garmentId.value = garment._id;
    if (submitBtn) submitBtn.textContent = "Modifier le vêtement";
    if (cancelBtn) cancelBtn.style.display = "inline-block";

    setSingleChoiceValue("placementGroup", "placement", garment.placement);
    setSingleChoiceValue("categoryGroup", "category", garment.category);
    setSingleChoiceValue("garmentSeasonGroup", "garmentSeason", garment.season);
    setMultiChoiceValues("moodTagsGroup", "moodTags", garment.moodTags || []);
    setMultiChoiceValues("occasionTagsGroup", "occasionTags", garment.occasionTags || []);

    if (currentImageUrl) currentImageUrl.value = garment.imageUrl || "";
    if (currentProcessedImageUrl) currentProcessedImageUrl.value = garment.processedImageUrl || "";

    if (preview) {
      preview.src = garment.processedImageUrl || garment.imageUrl || "";
      preview.style.display = preview.src ? "block" : "none";
    }

    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function setActiveDashboardPanel(targetId) {
    const tabs = Array.from(document.querySelectorAll(".dashboard-tab"));
    const panels = Array.from(document.querySelectorAll(".dashboard-panel"));

    tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.target === targetId));
    panels.forEach((panel) => panel.classList.toggle("active", panel.id === targetId));
  }

  async function downloadFileFromUrl(url, filename = `clauzia-${Date.now()}.png`) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Impossible de télécharger le fichier.");
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.startsWith("image/")) {
    throw new Error("Le fichier reçu n'est pas une image.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(objectUrl);
}

  async function loadDashboard() {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erreur lors du chargement du profil.");
      }

      const userName = document.getElementById("userName");
      const userEmail = document.getElementById("userEmail");
      const photoStatus = document.getElementById("photoStatus");
      const profileImage = document.getElementById("profileImage");

      if (userName) userName.textContent = data.name || "-";
      if (userEmail) userEmail.textContent = data.email || "-";
      if (photoStatus) photoStatus.textContent = data.profilePhotoUrl ? "Photo enregistrée" : "Aucune photo";
      if (profileImage && data.profilePhotoUrl) profileImage.src = data.profilePhotoUrl;

      localStorage.setItem("clauzia_user", JSON.stringify(data));
    } catch (error) {
      showMessage("photoMessage", error.message, "error");
    }
  }

  async function loadGarments() {
    const list = document.getElementById("garmentsList");
    if (!list) return;

    try {
      const response = await fetch(`${API_BASE}/api/garments`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const garments = await response.json();

      if (!response.ok) {
        list.innerHTML = `<p>Impossible de charger les vêtements.</p>`;
        return;
      }

      if (!garments.length) {
        list.innerHTML = "<p>Aucun vêtement ajouté pour le moment.</p>";
        return;
      }

      window.__clauziaGarments = garments;

      list.innerHTML = garments
        .map((g) => {
          const img = g.processedImageUrl || g.imageUrl;
          const statusText = g.available === false ? "Indisponible" : "Disponible";
          const toggleText = g.available === false ? "Rendre disponible" : "Indisponible";

          return `
            <div class="garment-card">
              <img src="${img}" alt="Vêtement" style="width:120px;height:120px;object-fit:cover;border-radius:12px;display:block;margin-bottom:10px;" />
              <p><strong>Placement :</strong> ${g.placement || "-"}</p>
              <p><strong>Catégorie :</strong> ${g.category || "-"}</p>
              <p><strong>Saison :</strong> ${g.season || "-"}</p>
              <p><strong>Humeur :</strong> ${(g.moodTags || []).join(", ") || "-"}</p>
              <p><strong>Occasion :</strong> ${(g.occasionTags || []).join(", ") || "-"}</p>
              <p><strong>Statut :</strong> ${statusText}</p>
              <div class="card-actions">
                <button type="button" class="edit-garment-btn small-button" data-id="${g._id}">Modifier</button>
                <button type="button" class="toggle-garment-btn secondary small-button" data-id="${g._id}" data-available="${g.available !== false}">
                  ${toggleText}
                </button>
                <button type="button" class="delete-garment-btn secondary small-button" data-id="${g._id}">Supprimer</button>
              </div>
            </div>
          `;
        })
        .join("");

      list.querySelectorAll(".edit-garment-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const garment = (window.__clauziaGarments || []).find(
            (item) => String(item._id) === String(btn.dataset.id)
          );
          if (garment) fillGarmentForm(garment);
          setActiveDashboardPanel("panel-add-garment");
        });
      });

      list.querySelectorAll(".toggle-garment-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;
          const currentAvailable = btn.dataset.available === "true";
          const nextAvailable = !currentAvailable;

          try {
            const response = await fetch(`${API_BASE}/api/garments/${id}/availability`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${getToken()}`,
              },
              body: JSON.stringify({ available: nextAvailable }),
            });

            const data = await response.json();

            if (!response.ok) {
              showMessage("garmentMessage", data.message || "Erreur lors du changement de statut.", "error");
              return;
            }

            showMessage("garmentMessage", data.message || "Statut mis à jour.", "success");
            loadGarments();
          } catch {
            showMessage("garmentMessage", "Impossible de joindre le serveur.", "error");
          }
        });
      });

      list.querySelectorAll(".delete-garment-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;

          if (!confirm("Supprimer ce vêtement définitivement ?")) return;

          try {
            const response = await fetch(`${API_BASE}/api/garments/${id}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${getToken()}`,
              },
            });

            const data = await response.json();

            if (!response.ok) {
              showMessage("garmentMessage", data.message || "Erreur lors de la suppression.", "error");
              return;
            }

            if (currentEditingGarmentId === id) {
              resetGarmentForm();
            }

            showMessage("garmentMessage", data.message || "Vêtement supprimé.", "success");
            loadGarments();
          } catch {
            showMessage("garmentMessage", "Impossible de joindre le serveur.", "error");
          }
        });
      });
    } catch {
      list.innerHTML = "<p>Erreur lors du chargement des vêtements.</p>";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const currentPath = window.location.pathname;

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("clauzia_token");
        localStorage.removeItem("clauzia_user");
        window.location.href = "login.html";
      });
    }

    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();

        try {
          const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            showMessage("registerMessage", data.message || "Erreur lors de l'inscription.", "error");
            return;
          }

          showMessage("registerMessage", "Compte créé avec succès. Redirection...", "success");
          setTimeout(() => {
            window.location.href = "login.html";
          }, 1000);
        } catch {
          showMessage("registerMessage", "Impossible de joindre le serveur.", "error");
        }
      });
    }

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();

        try {
          const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            showMessage("loginMessage", data.message || "Erreur lors de la connexion.", "error");
            return;
          }

          localStorage.setItem("clauzia_token", data.token);
          localStorage.setItem("clauzia_user", JSON.stringify(data.user));

          showMessage("loginMessage", "Connexion réussie. Redirection...", "success");
          setTimeout(() => {
            window.location.href = "dashboard.html";
          }, 1000);
        } catch {
          showMessage("loginMessage", "Impossible de joindre le serveur.", "error");
        }
      });
    }

    if (currentPath.includes("dashboard.html")) {
      redirectIfNotLoggedIn();

      setupSingleChoiceChips("moodGroup", "mood");
      setupSingleChoiceChips("occasionGroup", "occasion");
      setupSingleChoiceChips("recommendationSeasonGroup", "recommendationSeason");
      setupSingleChoiceChips("placementGroup", "placement");
      setupSingleChoiceChips("categoryGroup", "category");
      setupSingleChoiceChips("garmentSeasonGroup", "garmentSeason");
      setupMultiChoiceChips("moodTagsGroup", "moodTags");
      setupMultiChoiceChips("occasionTagsGroup", "occasionTags");

      bindCameraButtons("openProfileCameraBtn", "profilePhotoCamera");
      bindCameraButtons("openGarmentCameraBtn", "garmentImageCamera");

      setupPreviewFromInputs("profilePhotoPreview", "profilePhoto", "profilePhotoCamera");
      setupPreviewFromInputs("garmentPreview", "garmentImage", "garmentImageCamera");

      const clearProfilePhotoBtn = document.getElementById("clearProfilePhotoBtn");
      if (clearProfilePhotoBtn) {
        clearProfilePhotoBtn.addEventListener("click", () => {
          clearFileInputs("profilePhoto", "profilePhotoCamera");
          const preview = document.getElementById("profilePhotoPreview");
          if (preview) {
            preview.src = "";
            preview.style.display = "none";
          }
        });
      }

      const clearGarmentPhotoBtn = document.getElementById("clearGarmentPhotoBtn");
      if (clearGarmentPhotoBtn) {
        clearGarmentPhotoBtn.addEventListener("click", () => {
          clearFileInputs("garmentImage", "garmentImageCamera");
          const preview = document.getElementById("garmentPreview");
          if (preview) {
            preview.src = "";
            preview.style.display = "none";
          }
        });
      }

      loadDashboard();
      loadGarments();

      const tabs = Array.from(document.querySelectorAll(".dashboard-tab"));
      if (tabs.length) {
        tabs.forEach((tab) => {
          tab.addEventListener("click", () => {
            setActiveDashboardPanel(tab.dataset.target);
          });
        });

        const defaultTab = document.querySelector(".dashboard-tab.active");
        if (defaultTab) setActiveDashboardPanel(defaultTab.dataset.target);
      }

      const photoForm = document.getElementById("photoForm");
      if (photoForm) {
        photoForm.addEventListener("submit", async (e) => {
          e.preventDefault();

          const file = getFirstSelectedFile("profilePhotoCamera", "profilePhoto");
          if (!file) {
            showMessage("photoMessage", "Choisis ou prends une photo.", "error");
            return;
          }

          const formData = new FormData();
          formData.append("profilePhoto", file);

          try {
            const response = await fetch(`${API_BASE}/api/users/profile-photo`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${getToken()}`,
              },
              body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
              showMessage("photoMessage", data.message || "Erreur lors de l'envoi.", "error");
              return;
            }

            if (data.user && data.user.profilePhotoUrl) {
              const profileImage = document.getElementById("profileImage");
              const photoStatus = document.getElementById("photoStatus");

              if (profileImage) profileImage.src = data.user.profilePhotoUrl;
              if (photoStatus) photoStatus.textContent = "Photo enregistrée";

              localStorage.setItem("clauzia_user", JSON.stringify(data.user));
            }

            clearFileInputs("profilePhoto", "profilePhotoCamera");
            const profilePreview = document.getElementById("profilePhotoPreview");
            if (profilePreview) {
              profilePreview.src = "";
              profilePreview.style.display = "none";
            }

            showMessage("photoMessage", "Photo de profil mise à jour.", "success");
          } catch {
            showMessage("photoMessage", "Impossible de joindre le serveur.", "error");
          }
        });
      }

      const recommendationForm = document.getElementById("recommendationForm");
      if (recommendationForm) {
        recommendationForm.addEventListener("submit", async (e) => {
          e.preventDefault();

          const mood = document.getElementById("mood").value.trim();
          const occasion = document.getElementById("occasion").value.trim();
          const season = document.getElementById("recommendationSeason").value.trim();

          try {
            const response = await fetch(`${API_BASE}/api/recommendations`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${getToken()}`,
              },
              body: JSON.stringify({ mood, occasion, season }),
            });

            const data = await response.json();

            if (!response.ok) {
              showMessage("recommendationMessage", data.message || "Erreur lors de la recommandation.", "error");
              return;
            }

            const top = data.recommendations?.top;
            const bottom = data.recommendations?.bottom;
            const shoes = data.recommendations?.shoes;
            const accessory = data.recommendations?.accessory;

            const result = document.getElementById("recommendationResult");
            if (result) {
              result.innerHTML = `
                <div class="result-card">
                  <h3>Tenue recommandée</h3>
                  <p><strong>Haut :</strong> ${top ? top.category || "Vêtement sélectionné" : "-"}</p>
                  <p><strong>Bas :</strong> ${bottom ? bottom.category || "Vêtement sélectionné" : "-"}</p>
                  <p><strong>Chaussures :</strong> ${shoes ? shoes.category || "Vêtement sélectionné" : "-"}</p>
                  <p><strong>Accessoire :</strong> ${accessory ? accessory.category || "Vêtement sélectionné" : "-"}</p>
                  ${top?.processedImageUrl ? `<img src="${top.processedImageUrl}" style="width:140px;height:140px;object-fit:cover;border-radius:12px;margin-right:10px;" />` : ""}
                  ${bottom?.processedImageUrl ? `<img src="${bottom.processedImageUrl}" style="width:140px;height:140px;object-fit:cover;border-radius:12px;margin-right:10px;" />` : ""}
                  ${shoes?.processedImageUrl ? `<img src="${shoes.processedImageUrl}" style="width:140px;height:140px;object-fit:cover;border-radius:12px;margin-right:10px;" />` : ""}
                  ${accessory?.processedImageUrl ? `<img src="${accessory.processedImageUrl}" style="width:140px;height:140px;object-fit:cover;border-radius:12px;" />` : ""}
                </div>
              `;
            }

            window.__clauziaLastRecommendation = {
              ...data.recommendations,
              context: { mood, occasion, season },
            };

            localStorage.setItem(
              "clauzia_last_recommendation",
              JSON.stringify(window.__clauziaLastRecommendation)
            );

            showMessage("recommendationMessage", "Recommandation générée.", "success");
          } catch {
            showMessage("recommendationMessage", "Impossible de joindre le serveur.", "error");
          }
        });
      }

      const generateOutfitBtn = document.getElementById("generateOutfitBtn");
      if (generateOutfitBtn) {
        generateOutfitBtn.addEventListener("click", async () => {
          const rec =
            window.__clauziaLastRecommendation ||
            JSON.parse(localStorage.getItem("clauzia_last_recommendation") || "null");

          if (!rec) {
            showMessage(
              "generateOutfitMessage",
              "Commence par générer une recommandation avant de créer une tenue.",
              "error"
            );
            return;
          }

          try {
            const response = await fetch(`${API_BASE}/api/outfit/generate-image`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${getToken()}`,
              },
              body: JSON.stringify({
                topId: rec.top?._id || null,
                bottomId: rec.bottom?._id || null,
                shoesId: rec.shoes?._id || null,
                accessoryId: rec.accessory?._id || null,
                mood: rec.context?.mood || "",
                occasion: rec.context?.occasion || "",
                season: rec.context?.season || "",
              }),
            });

            const data = await response.json();

            if (!response.ok) {
              showMessage("generateOutfitMessage", data.message || "Erreur lors de la génération.", "error");
              return;
            }

            currentGeneratedImageUrl = data.generatedImageUrl || null;

            const result = document.getElementById("generatedOutfitResult");
            if (result) {
              result.innerHTML = `
                <div class="result-card">
                  <h3>Image de tenue générée</h3>
                  <img src="${data.generatedImageUrl}" alt="Tenue générée" style="max-width:100%; border-radius:14px; margin-top:12px;" />
                  <div class="result-actions">
                    <button type="button" id="downloadGeneratedImageBtn" class="small-button">Télécharger l'image</button>
                  </div>
                </div>
              `;

              const downloadBtn = document.getElementById("downloadGeneratedImageBtn");
              if (downloadBtn) {
                downloadBtn.addEventListener("click", async () => {
                  if (!currentGeneratedImageUrl) return;

                  try {
                    await downloadFileFromUrl(
                      currentGeneratedImageUrl,
                      `clauzia-look-${Date.now()}.png`
                    );
                    showMessage("generateOutfitMessage", "Image téléchargée.", "success");
                  } catch (error) {
                    showMessage("generateOutfitMessage", error.message, "error");
                  }
                });
              }
            }

            showMessage(
              "generateOutfitMessage",
              "Image générée avec succès.",
              "success"
            );
          } catch {
            showMessage("generateOutfitMessage", "Impossible de joindre le serveur.", "error");
          }
        });
      }

      const garmentForm = document.getElementById("garmentForm");
      if (garmentForm) {
        garmentForm.addEventListener("submit", async (e) => {
          e.preventDefault();

          const file = getFirstSelectedFile("garmentImageCamera", "garmentImage");
          const placement = document.getElementById("placement").value.trim();

          if (!placement) {
            showMessage("garmentMessage", "Choisis le placement du vêtement.", "error");
            return;
          }

          const isEditing = !!currentEditingGarmentId;
          const hasFile = !!file;

          if (!isEditing && !hasFile) {
            showMessage("garmentMessage", "Choisis ou prends une photo de vêtement.", "error");
            return;
          }

          const formData = new FormData();
          if (hasFile) {
            formData.append("garmentImage", file);
          }

          formData.append("placement", placement);
          formData.append("category", document.getElementById("category").value.trim());
          formData.append("season", document.getElementById("garmentSeason").value.trim());
          formData.append("moodTags", document.getElementById("moodTags").value.trim());
          formData.append("occasionTags", document.getElementById("occasionTags").value.trim());

          try {
            const url = isEditing
              ? `${API_BASE}/api/garments/${currentEditingGarmentId}`
              : `${API_BASE}/api/garments`;

            const response = await fetch(url, {
              method: isEditing ? "PUT" : "POST",
              headers: {
                Authorization: `Bearer ${getToken()}`,
              },
              body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
              showMessage(
                "garmentMessage",
                data.message || "Erreur lors de l'ajout/modification.",
                "error"
              );
              return;
            }

            showMessage(
              "garmentMessage",
              isEditing ? "Vêtement modifié avec succès." : "Vêtement ajouté avec succès.",
              "success"
            );

            resetGarmentForm();
            clearFileInputs("garmentImage", "garmentImageCamera");
            loadGarments();
          } catch {
            showMessage("garmentMessage", "Impossible de joindre le serveur.", "error");
          }
        });
      }

      const cancelGarmentEditBtn = document.getElementById("cancelGarmentEditBtn");
      if (cancelGarmentEditBtn) {
        cancelGarmentEditBtn.addEventListener("click", () => {
          resetGarmentForm();
        });
      }
    }

    const authStatus = document.getElementById("authStatus");
    if (authStatus) {
      const user = getStoredUser();

      if (user) {
        authStatus.textContent = `Connecté en tant que ${user.name} (${user.email})`;
        if (logoutBtn) logoutBtn.style.display = "inline-block";
      } else {
        authStatus.textContent = "Aucun utilisateur connecté";
        if (logoutBtn) logoutBtn.style.display = "none";
      }
    }
  });