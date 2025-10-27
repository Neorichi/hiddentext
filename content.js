(async function () {

    // Function to get the key from the 'private_key' file
    async function getKey() {
      try {
        const url = chrome.runtime.getURL("private_key");
        const response = await fetch(url);
        const text = await response.text();
        console.log("Clave leída:", text.trim());
        return text.trim();
      } catch (err) {
        console.error("Error al leer private_key:", err);
        return "";
      }
    }


    function encryptText(text, key) {
        return CryptoJS.AES.encrypt(text, key).toString();
    }

    function decryptText(encrypted, key) {
        const bytes = CryptoJS.AES.decrypt(encrypted, key);
        return bytes.toString(CryptoJS.enc.Utf8);
    }

    const isWhatsApp = location.hostname.includes("whatsapp");
    const isTelegram = location.hostname.includes("web.telegram");

    const ZERO = '\u2060';
    const ONE = '\u2063';

    function textToInvisibles(secret) {
        return [...secret]
            .map(c => c.charCodeAt(0).toString(2).padStart(8, '0'))
            .join('')
            .split('')
            .map(b => b === '0' ? ZERO : ONE)
            .join('');
    }

    function invisiblesToText(chars) {
        const binary = chars.map(c => c === ZERO ? '0' : '1').join('');
        let message = '';
        for (let i = 0; i < binary.length; i += 8) {
            const byte = binary.slice(i, i + 8);
            if (byte.length === 8) {
                message += String.fromCharCode(parseInt(byte, 2));
            }
        }
        return message;
    }

    async function showSecretsInMessages() {
        try {
          const show = localStorage.getItem("show-secrets") !== "false";
          const key = await getKey();
          if (!show) {
            // Clean inserted tags
            document.querySelectorAll(".inserted-secret").forEach((el) => el.remove());
            document.querySelectorAll(".checked-secret").forEach((m) => m.classList.remove("checked-secret"));
            return;
          }

          // Select messages according to platform. As a fallback, grab all role="row"/[data-id] candidates.
          let messages = [];
          if (isWhatsApp) {
            messages = document.querySelectorAll('[data-id], [role="row"]');
          } else if (isTelegram) {
            messages = Array.from(document.querySelectorAll('[data-message-id], [data-peer-id]'))
              .filter(m =>
                !m.isContentEditable &&                     // descarta si el elemento es editable
                !m.closest('[contenteditable="true"]') &&   // descarta si está dentro de un input editable
                !m.classList.contains('input-message-input') // descarta específicamente el campo de escritura
              );
          } else {
            messages = document.querySelectorAll('[data-id], [data-message-id], [role="row"]');
          }




          messages.forEach((m) => {
            try {
              const alreadyHas = m.querySelector(".inserted-secret");
              if (m.classList.contains("checked-secret") && alreadyHas) return;

              const text = m.innerText || "";
              if (!text) {
                m.classList.add("checked-secret");
                return;
              }

              // Collect leading invisibles
              const chars = [...text];
              const invisibles = [];
              for (let i = 0; i < chars.length; i++) {
                if (chars[i] === ZERO || chars[i] === ONE) {
                  invisibles.push(chars[i]);
                } else {
                  break;
                }
              }

              if (invisibles.length > 0 && !alreadyHas) {
                const encrypted = invisiblesToText(invisibles);
                const secret = decryptText(encrypted, key);
                const tag = document.createElement("span");
                tag.className = "inserted-secret";
                tag.textContent = `${secret}`;
                Object.assign(tag.style, {
                float: "left",
                marginRight: "20%",
                color: "crimson",
                fontSize: "12px",
                padding: "2px 6px",
                background: "rgba(220, 20, 60, 0.1)",
                borderLeft: "3px solid crimson",
                borderRadius: "4px",
                display: "inline-block", // 👈 asegura que quede en línea
                verticalAlign: "middle"
              });

              // Inserta al principio (secreto antes que texto)
              m.appendChild(tag, m.firstChild);
              }

              m.classList.add("checked-secret");
            } catch (inner) {
              console.warn("Error procesando un mensaje:", inner);
            }
          });
        } catch (e) {
          console.error("showSecretsInMessages() falló:", e);
        }
      }

    const panel = document.createElement("div");
    panel.id = "secret-panel";
    panel.style.position = "fixed";
    panel.style.bottom = "10px";
    panel.style.right = "10px";
    panel.style.background = "var(--panel-bg, #fff)";
    panel.style.color = "var(--panel-text, #000)";
    panel.style.padding = "8px";
    panel.style.borderRadius = "8px";
    panel.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    panel.style.zIndex = "999999";
    panel.style.fontSize = "14px";
    panel.style.width = "220px";
    panel.style.userSelect = "none";

    const minimizeButton = document.createElement("button");
    minimizeButton.textContent = "–";
    minimizeButton.title = "Minimize";
    minimizeButton.style.position = "absolute";
    minimizeButton.style.top = "4px";
    minimizeButton.style.right = "6px";
    minimizeButton.style.border = "none";
    minimizeButton.style.background = "transparent";
    minimizeButton.style.cursor = "pointer";
    minimizeButton.style.fontSize = "16px";
    minimizeButton.style.color = "inherit";

    let minimized = false;
    minimizeButton.onclick = (e) => {
        e.stopPropagation();
        minimized = !minimized;
        panelContent.style.display = minimized ? "none" : "block";
        minimizeButton.textContent = minimized ? "+" : "–";
    };

    const panelContent = document.createElement("div");

    const labelSecret = document.createElement("label");
    labelSecret.textContent = "🔐 Fixed secret:";
    labelSecret.style.display = "block";
    labelSecret.style.marginBottom = "4px";

    const inputFixedSecret = document.createElement("input");
    inputFixedSecret.type = "text";
    inputFixedSecret.style.width = "100%";
    inputFixedSecret.style.marginBottom = "6px";
    inputFixedSecret.style.padding = "2px";

    const autoInsertContainer = document.createElement("label");
    autoInsertContainer.style.display = "flex";
    autoInsertContainer.style.alignItems = "center";
    autoInsertContainer.style.gap = "6px";
    autoInsertContainer.style.cursor = "pointer";

    const autoInsertCheckbox = document.createElement("input");
    autoInsertCheckbox.type = "checkbox";
    autoInsertCheckbox.style.cssText = "width: 16px !important; height: 16px !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; margin: 0 !important; cursor: pointer !important; flex-shrink: 0 !important;";
    const autoInsertText = document.createElement("span");
    autoInsertText.textContent = "Auto insert";
    autoInsertText.style.cssText = "margin-left: 20px;";

    autoInsertContainer.appendChild(autoInsertCheckbox);
    autoInsertContainer.appendChild(autoInsertText);

    const toggleViewContainer = document.createElement("label");
    toggleViewContainer.style.display = "flex";
    toggleViewContainer.style.alignItems = "center";
    toggleViewContainer.style.gap = "6px";
    toggleViewContainer.style.marginTop = "6px";
    toggleViewContainer.style.cursor = "pointer";

    const viewCheckbox = document.createElement("input");
    viewCheckbox.type = "checkbox";
    viewCheckbox.style.cssText = "width: 16px !important; height: 16px !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; margin: 0 !important; cursor: pointer !important; flex-shrink: 0 !important;";
    viewCheckbox.checked = localStorage.getItem("show-secrets") !== "false";

    const viewText = document.createElement("span");
    viewText.textContent = "Show secrets";
    viewText.style.cssText = "margin-left: 20px;";

    toggleViewContainer.appendChild(viewCheckbox);
    toggleViewContainer.appendChild(viewText);

    panelContent.appendChild(labelSecret);
    panelContent.appendChild(inputFixedSecret);
    panelContent.appendChild(autoInsertContainer);
    panelContent.appendChild(toggleViewContainer);

    panel.appendChild(minimizeButton);
    panel.appendChild(panelContent);
    document.body.appendChild(panel);

    inputFixedSecret.value = localStorage.getItem("fixed-secret") || "";
    autoInsertCheckbox.checked = localStorage.getItem("auto-secret") === "true";

    inputFixedSecret.oninput = () => {
        localStorage.setItem("fixed-secret", inputFixedSecret.value);
    };
    autoInsertCheckbox.onchange = () => {
        localStorage.setItem("auto-secret", autoInsertCheckbox.checked);
    };
    viewCheckbox.onchange = () => {
        localStorage.setItem("show-secrets", viewCheckbox.checked);
        showSecretsInMessages();
    };

    if (isWhatsApp) {
        window.addEventListener("keydown", async function (event) {
            if (event.key === "Enter" && !event.shiftKey && autoInsertCheckbox.checked) {
                const input = document.querySelector('div[contenteditable="true"][data-tab="10"]');
                if (!input) return;

                const text = input.innerText.trim();
                const secret = inputFixedSecret.value.trim();
                if (!secret || text.startsWith(ZERO) || text.startsWith(ONE)) return;

                event.preventDefault();
                event.stopPropagation();

                const key = await getKey();
                const hidden = textToInvisibles(encryptText(secret, key));

                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(input);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                document.execCommand("insertText", false, hidden);

                range.selectNodeContents(input);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);

                setTimeout(() => {
                    const enterAgain = new KeyboardEvent("keydown", {
                        key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true
                    });
                    input.dispatchEvent(enterAgain);
                }, 100);
            }
        }, true);

        const observer = new MutationObserver(showSecretsInMessages);
        const startObserver = () => {
            const container = document.querySelector('#app');
            if (container) {
                observer.observe(container, { childList: true, subtree: true });
                showSecretsInMessages();
            } else {
                setTimeout(startObserver, 1000);
            }
        };
        startObserver();
    } else if (isTelegram) {
        let lastProcessedText = "";

        const inputObserver = new MutationObserver(async () => {
            if (!autoInsertCheckbox.checked) return;
            const input = document.querySelector('[contenteditable="true"]');
            if (!input) return;

            const text = input.innerText.trim();
            if (!text || text === lastProcessedText) return;

            const secret = inputFixedSecret.value;
            if (!secret || text.startsWith(ZERO) || text.startsWith(ONE)) return;

            lastProcessedText = text;

            const key = await getKey();
            const encrypted = encryptText(secret, key);
            const hidden = textToInvisibles(encrypted);

            // Usar textContent en lugar de innerText para preservar caracteres invisibles
            const textNode = document.createTextNode(hidden);
            input.insertBefore(textNode, input.firstChild);

            // Mover cursor al final
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(input);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        });

        const waitForInput = setInterval(() => {
            const input = document.querySelector('[contenteditable="true"]');
            if (input) {
                inputObserver.observe(input, { childList: true, subtree: true, characterData: true });
                clearInterval(waitForInput);
            }
        }, 500);

        const observer = new MutationObserver(showSecretsInMessages);
        observer.observe(document.body, { childList: true, subtree: true });
        showSecretsInMessages();
    }

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (isDark) {
        document.documentElement.style.setProperty('--panel-bg', '#222');
        document.documentElement.style.setProperty('--panel-text', '#eee');
    }
})();
