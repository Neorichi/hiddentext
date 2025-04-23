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
        const show = localStorage.getItem("show-secrets") !== "false";
        const key = await getKey();
        const messages = document.querySelectorAll(isWhatsApp ? '[data-id]' : '[data-message-id]');

        messages.forEach(m => {
            const alreadyHas = m.querySelector('.inserted-secret');

            if (!show) {
                if (alreadyHas) alreadyHas.remove();
                m.classList.remove("checked-secret");
                return;
            }

            if (m.classList.contains("checked-secret") && alreadyHas) return;

            const text = m.innerText;
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
                let secret;
                try {
                    secret = decryptText(encrypted, key);
                } catch {
                    secret = "[Decryption error]";
                }
                const tag = document.createElement("span");
                tag.className = "inserted-secret";
                tag.textContent = `${secret}`;
                tag.style.color = 'crimson';
                tag.style.margin = '4px 0';
                tag.style.fontSize = '12px';
                tag.style.alignSelf = 'flex-start';
                tag.style.maxWidth = '60%';
                tag.style.wordBreak = 'break-word';
                tag.style.padding = '2px 6px';
                tag.style.background = 'rgba(220, 20, 60, 0.1)';
                tag.style.borderLeft = '3px solid crimson';
                tag.style.borderRadius = '4px';
                tag.style.marginLeft = '8px';
                m.appendChild(tag);
            }

            m.classList.add("checked-secret");
        });
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
    autoInsertCheckbox.style.transform = "scale(1.1)";
    const autoInsertText = document.createElement("span");
    autoInsertText.textContent = "Auto insert";

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
    viewCheckbox.style.transform = "scale(1.1)";
    viewCheckbox.checked = localStorage.getItem("show-secrets") !== "false";

    const viewText = document.createElement("span");
    viewText.textContent = "Show secrets";

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
        const inputObserver = new MutationObserver(async () => {
            if (!autoInsertCheckbox.checked) return;
            const input = document.querySelector('[contenteditable="true"]');
            if (!input || !input.innerText.trim()) return;

            const text = input.innerText.trim();
            const secret = inputFixedSecret.value;
            if (!secret || text.startsWith(ZERO) || text.startsWith(ONE)) return;

            const key = await getKey();
            const hidden = textToInvisibles(encryptText(secret, key));
            input.innerText = hidden + text;

            const sel = window.getSelection();
            sel.selectAllChildren(input);
            sel.collapseToEnd();
        });

        const waitForInput = setInterval(() => {
            const input = document.querySelector('[contenteditable="true"]');
            if (input) {
                inputObserver.observe(input, { childList: true, subtree: true });
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
