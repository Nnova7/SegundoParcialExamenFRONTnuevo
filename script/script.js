// =====================================
// VARIABLES GLOBALES
// =====================================
let currentUser = null;
let paymentStatus = false;
let examTaken = false;
let contactMessages = [];
let examTimer = null;
let examTimeLeft = 10800; // 3 horas
let examQuestions = [];
let examApproved = false;

// =====================================
// INICIALIZACIÓN DESPUÉS DEL DOM
// =====================================
document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ Página cargada - Inicializando JavaScript");

  // Referencias del DOM
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userDisplay = document.getElementById("user-display");
  const loginModal = document.getElementById("login-modal");
  const closeModal = document.querySelector(".close-modal");
  const loginForm = document.getElementById("login-form");
  const payBtn = document.getElementById("pay-btn-fullstack");
  const contactForm = document.getElementById("contact-form");
  const examBtn = document.getElementById("exam-btn-fullstack");

  // Examen
  const examModal = document.getElementById("exam-modal");
  const examTimerDisplay = document.getElementById("exam-timer");
  const examQuestionsContainer = document.getElementById("exam-questions");
  const submitExamBtn = document.getElementById("submit-exam-btn");
  const closeExamModal = document.querySelector(".close-exam-modal");

  // ===============================
  // CARGAR SESIÓN GUARDADA
  // ===============================
  loadSession();

  // ===============================
  // ABRIR / CERRAR MODAL DE LOGIN
  // ===============================
  if (loginBtn && loginModal)
    loginBtn.addEventListener("click", () => (loginModal.style.display = "flex"));
  if (closeModal)
    closeModal.addEventListener("click", () => (loginModal.style.display = "none"));

  // ===============================
  // LOGIN
  // ===============================
  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const cuenta = document.getElementById("username").value.trim();
      const contrasena = document.getElementById("password").value.trim();

      if (!cuenta || !contrasena) {
        showAlert("Campos vacíos", "Por favor, ingrese usuario y contraseña.", "warning");
        return;
      }

      try {
        const response = await fetch("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cuenta, contrasena }),
        });

        const data = await response.json();

        if (response.ok && data.usuario) {
          // ✅ Guardar usuario y token
          currentUser = {
            cuenta: data.usuario.cuenta,
            nombreCompleto: data.usuario.nombre,
            pago: data.usuario.pago || false,
            intento: data.usuario.intento || false,
          };

          paymentStatus = currentUser.pago;
          examTaken = currentUser.intento;

          localStorage.setItem("currentUser", JSON.stringify(currentUser));
          localStorage.setItem("paymentStatus", paymentStatus.toString());
          localStorage.setItem("examTaken", examTaken.toString());
          if (data.token) {
            localStorage.setItem("authToken", data.token);
            console.log("🔑 Token guardado correctamente.");
          }

          updateUserInterface();
          if (loginModal) loginModal.style.display = "none";
          showAlert("Acceso permitido", `Bienvenido ${currentUser.nombreCompleto}`, "success");
        } else {
          showAlert("Acceso denegado", data.message || "Usuario o contraseña incorrectos.", "error");
        }
      } catch (error) {
        console.error("❌ Error al conectar con el servidor:", error);
        showAlert("Error de conexión", "No se pudo conectar con el servidor.", "error");
      }

      loginForm.reset();
    });
  }

  // ===============================
  // LOGOUT
  // ===============================
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      if (examTimer) clearInterval(examTimer);

      if (currentUser) {
        try {
          await logoutBackend(currentUser.cuenta);
        } catch (error) {
          console.error("Error al cerrar sesión en el backend:", error);
        }
      }

      // 🧹 Limpiar datos
      currentUser = null;
      paymentStatus = false;
      examTaken = false;
      localStorage.clear();

      userDisplay.textContent = "Invitado";
      loginBtn.style.display = "inline-block";
      logoutBtn.style.display = "none";

      if (examBtn) {
        examBtn.disabled = true;
        examBtn.textContent = "Iniciar Examen";
      }

      if (examModal) examModal.style.display = "none";
      showAlert("Sesión cerrada", "Has cerrado sesión correctamente", "info");
    });
  }

  // ===============================
  // PAGO
  // ===============================
  if (payBtn) {
    payBtn.addEventListener("click", async function (event) {
      event.preventDefault();

      if (!currentUser) {
        showAlert("Acceso requerido", "Debe iniciar sesión para pagar", "warning");
        return;
      }
      if (paymentStatus) {
        showAlert("Pago ya realizado", "Ya has pagado esta certificación", "info");
        return;
      }

      const confirmacion = await showConfirm(
        "Confirmar pago",
        "¿Deseas pagar $3000 MX por la certificación de JavaScript?",
        "Pagar",
        "Cancelar"
      );

      if (!confirmacion.isConfirmed) return;

      try {
        Swal.fire({ title: "Procesando pago...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const token = localStorage.getItem("authToken");
        const res = await fetch("http://localhost:3000/api/pago/confirmar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        Swal.close();

        if (res.ok) {
          paymentStatus = true;
          currentUser.pago = true;
          localStorage.setItem("paymentStatus", "true");
          localStorage.setItem("currentUser", JSON.stringify(currentUser));

          payBtn.textContent = "Pagado";
          payBtn.disabled = true;
          payBtn.classList.replace("btn-primary", "btn-disabled");

          showAlert("Pago exitoso", data.msg || "Pago realizado correctamente.", "success");
          examBtn.disabled = false;
          examBtn.classList.replace("btn-disabled", "btn-secondary");
        } else {
          showAlert("Error en el pago", data.msg || "No se pudo procesar el pago.", "error");
        }
      } catch (error) {
        Swal.close();
        console.error("Error al procesar el pago:", error);
        showAlert("Error de conexión", "Hubo un problema con el servidor.", "error");
      }
    });
  }

  // ===============================
  // INICIAR EXAMEN
  // ===============================
  if (examBtn) {
    examBtn.addEventListener("click", async function () {
      if (!currentUser) {
        showAlert("Acceso requerido", "Debe iniciar sesión", "warning");
        return;
      }
      if (!paymentStatus) {
        showAlert("Pago requerido", "Debe pagar antes del examen", "warning");
        return;
      }
      if (examTaken) {
        showAlert("Examen ya realizado", "Solo puede hacerlo una vez", "info");
        return;
      }

      const confirmacion = await showConfirm(
        "Iniciar Examen",
        "Duración: 3 horas. ¿Deseas comenzar?",
        "Comenzar",
        "Cancelar"
      );

      if (confirmacion.isConfirmed) startExam();
    });
  }

  // ===============================
  // CONTACTO
  // ===============================
  if (contactForm) {
    contactForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const nombre = document.getElementById("name").value;
      const correo = document.getElementById("email").value;
      const mensaje = document.getElementById("message").value;

      const response = await enviarContactoBackend(nombre, correo, mensaje);
      showAlert("Mensaje Enviado", response.message, "success");

      contactMessages.push({ nombre, correo, mensaje });
      contactForm.reset();
    });
  }

  // ===============================
  // CERRAR MODALES
  // ===============================
  window.addEventListener("click", (e) => {
    if (e.target === loginModal) loginModal.style.display = "none";
    if (e.target === examModal) examModal.style.display = "none";
  });

  // ===============================
  // IMPRIMIR CERTIFICADO
  // ===============================
  const btnImprimir = document.getElementById("btn-imprimir");
  if (btnImprimir)
    btnImprimir.addEventListener("click", function () {
      if (currentUser && examApproved) {
        window.print();
      } else {
        showAlert("Acceso denegado", "Debes aprobar el examen", "warning");
      }
    });
});

// ===============================
// FUNCIÓN: CARGAR SESIÓN
// ===============================
async function loadSession() {
  const savedUser = localStorage.getItem("currentUser");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    const token = localStorage.getItem("authToken");

    try {
      const res = await fetch(`http://localhost:3000/api/usuario/${currentUser.cuenta}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const userState = await res.json();
        paymentStatus = userState.pago;
        examTaken = userState.intento;
        examApproved = userState.aprobado;
      }
    } catch (e) {
      console.warn("⚠️ Error sincronizando con backend, usando datos locales");
    }

    updateUserInterface();
    checkPrintButton();
    console.log("Sesión cargada para:", currentUser.cuenta);
  }
}

// ===============================
// FUNCIONES AUXILIARES
// ===============================
function updateUserInterface() {
  const userDisplay = document.getElementById("user-display");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const payBtn = document.getElementById("pay-btn-fullstack");
  const examBtn = document.getElementById("exam-btn-fullstack");

  if (userDisplay) userDisplay.textContent = currentUser?.cuenta || "Invitado";
  if (loginBtn) loginBtn.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "inline-block";

  if (payBtn && paymentStatus) {
    payBtn.textContent = "Pagado";
    payBtn.disabled = true;
  }

  if (examBtn) {
    examBtn.disabled = !(paymentStatus && !examTaken);
    examBtn.textContent = examTaken ? "Examen Realizado" : "Iniciar Examen";
  }
}

function checkPrintButton() {
  const btn = document.getElementById("btn-imprimir");
  if (btn) btn.style.display = currentUser && examApproved ? "inline-block" : "none";
}

function showAlert(title, text, icon = "info") {
  if (typeof Swal !== "undefined") return Swal.fire({ title, text, icon });
  alert(`${title}: ${text}`);
}

function showConfirm(title, text, confirm = "Sí", cancel = "Cancelar") {
  if (typeof Swal !== "undefined")
    return Swal.fire({ title, text, icon: "question", showCancelButton: true, confirmButtonText: confirm, cancelButtonText: cancel });
  return Promise.resolve({ isConfirmed: confirm(`${title}: ${text}`) });
}

// ===============================
// API BACKEND
// ===============================
async function logoutBackend(usuario) {
  try {
    await fetch("http://localhost:3000/api/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario }),
    });
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
}

async function enviarContactoBackend(nombre, correo, mensaje) {
  try {
    const res = await fetch("http://localhost:3000/api/contacto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email: correo, mensaje }),
    });
    return await res.json();
  } catch {
    return { message: "Error al enviar contacto al servidor." };
  }
}
