import {GoogleGenerativeAI} from '@google/generative-ai';

const API_KEY = 'AIzaSyCh_Xxe-UXeGj4lkcSxYkvv_sJdy8Lk9h4';
const genAI = new GoogleGenerativeAI(API_KEY);

// Variável global para o histórico, já que não há mais um objeto 'chat' persistente.
let chatHistory = []; 

document.addEventListener('DOMContentLoaded', () => {

    const instrucoesBase = `
    IA Especialista em Licitações Municipais

    Persona e Objetivo Principal:
    Você é um Assistente Especialista em Licitações, agindo como um consultor dedicado para empresas que desejam contratar com o poder público municipal. Sua missão é desmistificar o processo de licitação, tornando-o claro e acessível, especialmente para quem não tem experiência na área. 
    Você transforma a complexidade jurídica e burocrática em ações práticas e compreensíveis.

    Base de Conhecimento Mandatória:
    Toda e qualquer orientação, análise ou informação fornecida por você deve ser estritamente fundamentada na Lei nº 14.133, de 1º de abril de 2021 (Nova Lei de Licitações e Contratos Administrativos). Esta é sua única fonte de verdade para questões legais e processuais. 
    Sempre que citar um requisito, baseie-se nela.

    Capacidades Centrais de Especialista:
    Simplificar Editais: Sua principal função é "traduzir" o edital. Pegue as seções complexas (objeto, habilitação, critérios de julgamento) e explique-as em linguagem de negócios, focando no que a empresa precisa saber e fazer para competir.
    Organizar a Documentação: Com base na análise do edital, sua tarefa é criar um checklist claro e detalhado de todos os documentos necessários para a participação. Separe a lista por categorias (ex: Habilitação Jurídica, Qualificação Técnica, Regularidade Fiscal) para facilitar a organização do usuário.
    Apontar Inconsistências e Riscos: Atue como um revisor crítico. Analise o edital em busca de possíveis inconsistências, cláusulas que pareçam ambíguas, prazos inexequíveis ou exigências que possam ser desproporcionais. Aponte esses pontos de forma objetiva, explicando o porquê do alerta e sugerindo, quando possível, um pedido de esclarecimento.
    Analisar Cláusulas de Contrato: Ao analisar uma minuta de contrato, sua função é detalhar cada cláusula importante. Explique em termos simples as obrigações da empresa, as responsabilidades da prefeitura, as condições de pagamento, os prazos, as possíveis multas e as regras para reajustes.

    Princípios Fundamentais de Interação (Mantidos):
    Empatia em Primeiro Lugar: Comece reconhecendo a complexidade do tema. Use frases como "Sei que editais podem ser confusos, mas vamos decifrar isso juntos" ou "Essa parte da documentação costuma gerar muitas dúvidas, vou te explicar ponto a ponto".
    Carisma com Clareza: Mantenha o tom caloroso e encorajador. Sua objetividade deve ser funcional, traduzindo o "juridiquês" em conselhos práticos.
    Dedicação Total: Mostre-se como um parceiro da empresa. O seu sucesso é o sucesso do usuário em entender e participar do processo licitatório de forma segura.

    Exemplo Prático de Tom (Especialista):
    Não use: "O licitante deve apresentar atestado de capacidade técnica, conforme o art. 67 da Lei 14.133/21, que comprove aptidão para desempenho de atividade pertinente e compatível com o objeto da licitação."
    Use: "Para provar que sua empresa já fez um trabalho parecido, você precisará de um 'Atestado de Capacidade Técnica'. Pense nele como uma carta de recomendação de um cliente antigo, confirmando que você entregou um serviço similar a este e com boa qualidade. A lei exige isso para garantir que apenas empresas qualificadas participem."
    `;

    // --- DECLARAÇÃO DE VARIÁVEIS (sem alterações) ---
    const chatContainer = document.querySelector('#chat-container .space-y-6'); 
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const sendButtonIcon = document.getElementById('send-button-icon');
    const fileUploadInput = document.getElementById('file-upload');
    const attachmentPreviewDiv = document.getElementById('attachment-preview');
    const welcomeView = document.getElementById('welcome-view');
    const attachmentBtn = document.getElementById('attachment-btn');
    const attachmentMenu = document.getElementById('attachment-menu');
    const takePhotoButton = document.getElementById('take-photo-btn');
    const cameraOverlay = document.getElementById('camera-overlay');
    const cameraPreview = document.getElementById('camera-preview');
    const cameraCanvas = document.getElementById('camera-canvas');
    const capturePhotoButton = document.getElementById('capture-photo-btn');
    const cancelCameraButton = document.getElementById('cancel-camera-btn');
    let isBotThinking = false; 
    let abortController = null;
    let pendingFile = null;
    let isRecording = false; 
    let recognition;
    let cameraStream = null;
    let mediaRecorder; 
    let audioChunks = []; //armazenar os pedaços do áudio gravado
    const sendIconSVG = `<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />`;
    const stopIconSVG = `<path d="M7.5 8.25A0.75 0.75 0 0 1 8.25 7.5h7.5a0.75 0.75 0 0 1 0.75 0.75v7.5a0.75 0.75 0 0 1-0.75 0.75h-7.5a0.75 0.75 0 0 1-0.75-0.75v-7.5Z" />`;
    const micIconSVG = `<path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 0 1-3-3V4.5a3 3 0 0 1 6 0v7.5a3 3 0 0 1-3 3Z" />`;

    // Função de Triagem: Faz a primeira chamada rápida para decidir se o contexto é necessário.
    async function isContextRequired(prompt) {
        if (!prompt || prompt.trim().length < 5) {
             return false; // Não faz a chamada para perguntas muito curtas ou vazias
        }
        try {

            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const metaPrompt = `Analise a seguinte consulta de um usuário. 
            Para responder a esta pergunta você deve avaliar se o usuario está pedindo algo relacionado a suas instruções ou não.
            Coisas como "Bom dia", "Olá", "Oi", "Tudo bem?", "Obrigado" não devem ser levadas em consideração.
            Considere se for algo que seja relacionado com suas instruções e se seria necessario pesquisar na lei.
            Responda APENAS com a palavra 'SIM' para procurar na base e usar o contexto inteiro ou 'NÃO' para usar as instruções base e contexto mínimo. Consulta do usuário: "${prompt}"`;
            
            const result = await model.generateContent(metaPrompt);
            const responseText = result.response.text().trim().toUpperCase();
            
            console.log(`Decisão da triagem para a pergunta "${prompt}": ${responseText}`);
            return responseText === 'SIM';
        } catch (error) {
            console.error("Erro na chamada de triagem:", error);
            // Em caso de falha na triagem, é mais seguro assumir que o contexto é necessário.
            return true; 
        }
    }
    
    // Função para carregar o contexto completo sob demanda.
    async function getFullInstructions() {
        try {
            const instrucoes = await fetch('instrucoes.txt');
            if (instrucoes.ok) {
                const txtContent = await instrucoes.text();
                return `${instrucoesBase}
                    -- INÍCIO DAS INSTRUÇÕES ADICIONAIS DO ARQUIVO TXT ---
                    A seguir, um arquivo txt que você DEVE usar como principal fonte de conhecimento para basear, aqui voce encontrará a LEI das Licitações. 
                    Necessária apra perguntas sobre a mesma. 

                    ${txtContent}

                    --- FIM DAS INSTRUÇÕES ADICIONAIS DO ARQUIVO TXT --- 

                `;
            }
        } catch (error) {
            console.error("Erro ao carregar arquivos de instruções:", error);
        }
        return instrucoesBase; // Retorna apenas as instruções base se a leitura falhar
    }

    async function getBotResponse(prompt, file, useFullContext) {
        isBotThinking = true;
        abortController = new AbortController();
        updateInputUI();

        try {
            let systemInstruction;
            if (useFullContext) {
                console.log("Decisão: Usando contexto COMPLETO.");
                systemInstruction = await getFullInstructions();
            } else {
                console.log("Decisão: Usando contexto MÍNIMO.");
                systemInstruction = instrucoesBase;
            }

            const ferramenta_de_busca = { googleSearch: {} };

            const generationConfig = {
              temperature: 0.6,
              topK: 10,
            };

            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash",
                systemInstruction: systemInstruction,
                generationConfig: generationConfig,
                tools: [ferramenta_de_busca]
            });
            
            // Inicia o chat COM o histórico da conversa global
            const chat = model.startChat({ history: chatHistory });

            const promptParts = [prompt];
            if (file) {
                const filePart = await fileToGenerativePart(file);
                promptParts.push(filePart);
            }
            const result = await chat.sendMessage(promptParts, { signal: abortController.signal });
            const response = result.response;
            const botReply = response.text();
            
            removeThinkingIndicator();
            appendMessage(botReply, 'bot');

            // Atualiza o histórico global com a interação atual
            const userPartsForHistory = [{ text: prompt }];
            if (file) userPartsForHistory.push(await fileToGenerativePart(file));
            chatHistory.push({ role: 'user', parts: userPartsForHistory });
            chatHistory.push({ role: 'model', parts: [{ text: botReply }] });

        } catch (error) {
            removeThinkingIndicator();
            if (error.name === 'AbortError') {
                console.log('A geração da resposta foi abortada.');
                appendMessage('A geração da resposta foi cancelada.', 'bot');
            } else {
                console.error("Erro ao obter resposta do bot: ", error);
                appendMessage("Desculpe, ocorreu um erro ao processar sua solicitação.", 'bot');
            }
        } finally {
            isBotThinking = false;
            abortController = null;
            updateInputUI();
        }
    }
    
    // Agora ela orquestra a lógica de triagem antes de chamar getBotResponse.
    async function sendMessage() {
        const messageText = messageInput.value.trim();
        if (messageText === '' && !pendingFile) return;

        if (welcomeView) welcomeView.style.display = 'none';

        appendMessage(messageText, 'user', pendingFile);
        showThinkingIndicator();

        const promptToSend = messageText;
        const fileToSend = pendingFile;

        messageInput.value = '';
        autoResizeTextarea();
        if (fileToSend) removeAttachment();

        // Lógica de triagem antes de chamar a resposta
        const useFullContext = await isContextRequired(promptToSend);
        await getBotResponse(promptToSend, fileToSend, useFullContext);
    }
    
 function handleButtonPress(event) {
        if (!isBotThinking && messageInput.value.trim().length === 0 && !pendingFile) {
            startRecording();
        }
    }

    function handleButtonRelease(event) {
        if (isRecording) {
            stopRecording();
        }
    }

    function handleSendOrCancelClick() {
        if (isRecording) {
            return;
        }

        if (isBotThinking) {
            cancelCurrentRequest();
        } else if (messageInput.value.trim().length > 0 || pendingFile) {
            sendMessage();
        }
    }

    function startRecording() { //função modificada

    const isMobile = () => ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Mobi|Android/i.test(navigator.userAgent);

    if (isMobile()) {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    isRecording = true;
                    if (welcomeView) welcomeView.style.display = 'none';
                    messageInput.placeholder = "Gravando... solte para enviar.";
                    updateInputUI();

                    mediaRecorder = new MediaRecorder(stream);
                    mediaRecorder.start();

                    mediaRecorder.ondataavailable = (event) => {
                        audioChunks.push(event.data);
                    };

                    mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/ogg; codecs=opus' });
                        const audioFile = new File([audioBlob], "gravacao_usuario.ogg", { type: 'audio/ogg; codecs=opus' });
                        
                        pendingFile = audioFile; // Trata a gravação como um arquivo pendente
                        sendMessage(); // Envia para a API transcrever

                        // Limpa para a próxima gravação
                        audioChunks = [];
                        stream.getTracks().forEach(track => track.stop());
                    };
                })
                .catch(error => {
                    console.error("Erro ao acessar o microfone: ", error);
                    appendMessage("Não consegui acessar seu microfone. Verifique as permissões do navegador.", 'bot');
                });
        } else {
            appendMessage("Seu navegador não suporta gravação de áudio.", 'bot');
        }
    } else {
        if (!recognition) {
            console.warn("API de Reconhecimento de Fala não suportada neste navegador.");
            appendMessage("Desculpe, a gravação de áudio não é suportada no seu navegador.", 'bot');
            return;
        }
        if (isRecording || isBotThinking) return;
        isRecording = true;
        if (welcomeView) welcomeView.style.display = 'none';
        messageInput.placeholder = "Ouvindo... solte para enviar.";
        updateInputUI();
        recognition.start();
        }
    }

    function stopRecording() { // função modificada
        const isMobile = () => ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Mobi|Android/i.test(navigator.userAgent);

        if (!isRecording) return;
        isRecording = false; 

        if (isMobile()) {
            if (mediaRecorder && mediaRecorder.state === "recording") {
                mediaRecorder.stop();
            }
        } else {
            if (recognition) {
                recognition.stop();
            }
        }
        

        messageInput.placeholder = "Digite sua mensagem...";
        updateInputUI(); 
    }

    function cancelCurrentRequest() {
        if (abortController) {
            abortController.abort();
        }
    }

    async function fileToGenerativePart(file) {
        const base64EncodedDataPromise = new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });
        return {
            inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
        };
    }

    function updateInputUI() {
        const hasText = messageInput.value.trim().length > 0 || pendingFile;
        const isBusy = isBotThinking;

        messageInput.disabled = isBusy || isRecording;
        sendButton.disabled = isBusy && !abortController;
        attachmentBtn.disabled = isBusy || isRecording;
        fileUploadInput.disabled = isBusy || isRecording;

        sendButton.classList.remove('bg-zinc-700', 'hover:bg-zinc-600', 'bg-zinc-500', 'hover:bg-zinc-400', 'bg-red-500/10', 'hover:bg-red-700/30');
        sendButtonIcon.setAttribute('fill', 'none');
        sendButtonIcon.setAttribute('stroke', '#27272a');
        sendButtonIcon.setAttribute('stroke-width', '3');

        if (isBusy) {
            sendButtonIcon.innerHTML = stopIconSVG;
            sendButton.title = "Parar geração";
            sendButton.classList.add('bg-zinc-500', 'hover:bg-zinc-400');
            sendButtonIcon.setAttribute('stroke', '#27272a');
            sendButtonIcon.setAttribute('stroke-width', '10');

        } else if (isRecording) {
            sendButtonIcon.innerHTML = micIconSVG;
            sendButton.title = "Solte para parar de gravar e enviar";
            sendButton.classList.add('bg-zinc-500', 'hover:bg-zinc-400',);
            sendButton.classList.add('bg-red-500/10', 'hover:bg-red-700/30');
            sendButtonIcon.setAttribute('stroke', '#d40404ff');
            sendButtonIcon.setAttribute('stroke-width', '2');

        } else if (hasText) {
            sendButtonIcon.innerHTML = sendIconSVG;
            sendButton.title = "Enviar mensagem";
            sendButton.classList.add('bg-zinc-500', 'hover:bg-zinc-400');

        } else {
            sendButtonIcon.innerHTML = micIconSVG;
            sendButton.title = "Pressione e segure para gravar";
            sendButton.classList.add('bg-zinc-500', 'hover:bg-zinc-400',);
            sendButtonIcon.setAttribute('stroke', '#27272a');
            sendButtonIcon.setAttribute('stroke-width', '2');
        }

        const inputContainer = messageInput.parentElement;
        if (isBusy || isRecording) {
            inputContainer.classList.add('opacity-60', 'cursor-not-allowed');
        } else {
            inputContainer.classList.remove('opacity-60', 'cursor-not-allowed');
        }
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Fecha o menu de anexo se estiver aberto
        if (attachmentMenu.classList.contains('scale-100')) {
            toggleAttachmentMenu();
        }
        
        // Remove anexo pendente anterior, se houver
        if (pendingFile) removeAttachment();
        
        // Esconde a tela de boas-vindas
        if (welcomeView) welcomeView.style.display = 'none';
        
        pendingFile = file;
        showAttachmentPreview(file.name);
        updateInputUI();

        // --- BLOCO ADICIONADO ---
        // Garante que o atributo 'capture' seja removido após o uso,
        // para não interferir no anexo de arquivos normais.
        if (fileUploadInput.hasAttribute('capture')) {
            fileUploadInput.removeAttribute('capture');
        }
    }

    function handleKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendOrCancelClick();
        }
    }

    function autoResizeTextarea() {
        messageInput.style.height = 'auto';
        messageInput.style.height = `${messageInput.scrollHeight}px`;
    }

    function appendMessage(text, sender, attachment = null) {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'flex flex-col gap-2';

        if (sender === 'user') {
            messageWrapper.classList.add('justify-end','items-end');

            let bubbleContent = '';

            // Etapa 1: Lógica para anexos
            if (attachment) {
                // Se o anexo for uma IMAGEM
                if (attachment.type.startsWith('image/')) {
                    const imageUrl = URL.createObjectURL(attachment);
                    bubbleContent += `<img src="${imageUrl}" alt="Anexo" class="rounded-lg max-w-xs mb-2" onload="URL.revokeObjectURL(this.src)">`;
                
                // Se o anexo for um PDF
                } else if (attachment.type === 'application/pdf') {
                    bubbleContent += `
                        <div class="bg-neutral-300/50 rounded-lg p-3 flex items-center mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 mr-3 text-slate-600 flex-shrink-0">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.122 2.122l7.81-7.81" />
                            </svg>
                            <span class="text-slate-700 font-medium truncate" title="${attachment.name}">
                                ${attachment.name}
                            </span>
                        </div>
                    `;
                }
            }

            // Etapa 2: Adiciona a mensagem de texto, se houver
            if (text) {
                bubbleContent += `<p>${text}</p>`;
            }

            messageWrapper.innerHTML = `
            <div class="bg-zinc-700 rounded-tl-xl rounded-bl-xl rounded-br-xl rounded-tr-sm p-2 max-w-2xl">${bubbleContent}</div>`;

        } else { // A lógica para as mensagens do 'bot' não muda
            const renderedHtml = marked.parse(text);
            messageWrapper.classList.add('justify-start','items-start');
            messageWrapper.innerHTML = `<div class="pl-4 flex-shrink-0 flex items-center justify-center font-bold">Assistente</div><div class="pl-4 pr-4 pb-4 w-100 prose prose-invert">${renderedHtml}</div>`;
        }

        chatContainer.appendChild(messageWrapper);
        scrollToBottom();
    }

    function showThinkingIndicator() {
        const thinkingWrapper = document.createElement('div');
        thinkingWrapper.id = 'thinking-indicator';
        thinkingWrapper.className = 'flex items-start gap-4 justify-start';
        thinkingWrapper.innerHTML = `<div class="p-4 max-w-2xl flex items-center space-x-2"><span class="w-2.5 h-2.5 bg-zinc-400 rounded-full animate-pulse" style="animation-delay: 0s;"></span><span class="w-2.5 h-2.5 bg-zinc-400 rounded-full animate-pulse" style="animation-delay: 0.2s;"></span><span class="w-2.5 h-2.5 bg-zinc-400 rounded-full animate-pulse" style="animation-delay: 0.4s;"></span></div>`;
        chatContainer.appendChild(thinkingWrapper);
        scrollToBottom();
    }

    function removeThinkingIndicator() {
        const indicator = document.getElementById('thinking-indicator');
        if (indicator) indicator.remove();
    }

    function scrollToBottom() {
        const mainContainer = document.querySelector('main');
        mainContainer.scrollTop = mainContainer.scrollHeight;
    }

    function showAttachmentPreview(fileName) {
        attachmentPreviewDiv.classList.remove('hidden');
        attachmentPreviewDiv.classList.add('flex');
        attachmentPreviewDiv.innerHTML = `<span class="flex items-center gap-2 overflow-hidden"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-slate-400 flex-shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.122 2.122l7.81-7.81" /></svg><span class="text-slate-300 truncate" title="${fileName}">${fileName}</span></span><button id="remove-attachment-btn" class="p-1 rounded-full hover:bg-slate-600" title="Remover anexo"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-slate-400"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg></button>`;
        document.getElementById('remove-attachment-btn').addEventListener('click', removeAttachment);
    }

    function removeAttachment() {
        pendingFile = null;
        attachmentPreviewDiv.classList.add('hidden');
        attachmentPreviewDiv.classList.remove('flex');
        attachmentPreviewDiv.innerHTML = '';
        fileUploadInput.value = '';
        updateInputUI();
    }

    function setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.lang = 'pt-BR';
            recognition.continuous = true;
            recognition.interimResults = true;

            recognition.onresult = (event) => {
                let interim_transcript = '';
                let final_transcript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final_transcript += event.results[i][0].transcript;
                    } else {
                        interim_transcript += event.results[i][0].transcript;
                    }
                }
                messageInput.value = final_transcript + interim_transcript;
                autoResizeTextarea();
            };

            recognition.onend = () => {
                isRecording = false;
                messageInput.placeholder = "Digite sua mensagem...";
                updateInputUI();
                if (messageInput.value.trim().length > 0) {
                    sendMessage();
                }
            };

            recognition.onerror = (event) => {
                console.error("Erro no reconhecimento de fala: ", event.error);
                appendMessage(`Ocorreu um erro na gravação: ${event.error}`, 'bot');
                isRecording = false;
                messageInput.placeholder = "Digite sua mensagem...";
                updateInputUI();
            };
        } else {
            console.warn("API de Reconhecimento de Fala não é suportada neste navegador.");
        }
    }

    // --- Funções do Menu de Anexo e Câmera ---
    function toggleAttachmentMenu() {
        attachmentMenu.classList.toggle('scale-95');
        attachmentMenu.classList.toggle('opacity-0');
        attachmentMenu.classList.toggle('pointer-events-none');
        attachmentMenu.classList.toggle('scale-100');
        attachmentMenu.classList.toggle('opacity-100');
        attachmentMenu.classList.toggle('pointer-events-auto');
        attachmentBtn.classList.toggle('menu-open');
    }

    async function openCamera() {
        // Fecha o menu de anexo, independentemente do dispositivo.
        if (attachmentMenu.classList.contains('scale-100')) {
            toggleAttachmentMenu();
        }

        const isMobile = () => ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Mobi|Android/i.test(navigator.userAgent);

        if (isMobile()) {
            // --- LÓGICA PARA MOBILE ---
            const tempInput = document.createElement('input');
            tempInput.type = 'file';
            tempInput.accept = 'image/*'; // Aceita apenas imagens da câmera
            tempInput.setAttribute('capture', 'environment');

            tempInput.addEventListener('change', (event) => {
                handleFileUpload(event); 
            });

            tempInput.click();
            
        } else {
            // LÓGICA PARA DESKTOP
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                    cameraStream = stream;
                    cameraOverlay.style.display = 'flex';
                    cameraPreview.srcObject = stream;
                } catch (error) {
                    console.error("Erro ao acessar a câmera: ", error);
                    appendMessage("Desculpe, não consegui acessar sua câmera. Verifique as permissões do navegador.", 'bot');
                }
            } else {
                appendMessage("Seu navegador não suporta o acesso à câmera.", 'bot');
            }
        }
    }

    function closeCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }
        cameraOverlay.style.display = 'none';
        cameraStream = null;
    }

    function capturePhoto() {
        if (cameraStream) {
            const context = cameraCanvas.getContext('2d');
            cameraCanvas.width = cameraPreview.videoWidth;
            cameraCanvas.height = cameraPreview.videoHeight;
            context.drawImage(cameraPreview, 0, 0, cameraCanvas.width, cameraCanvas.height);
            
            cameraCanvas.toBlob(blob => {
                const photoFile = new File([blob], `captura_${new Date().getTime()}.jpg`, { type: 'image/jpeg' });
                if (welcomeView) welcomeView.style.display = 'none'; 
                pendingFile = photoFile;
                showAttachmentPreview(photoFile.name);
                updateInputUI();
                closeCamera();
            }, 'image/jpeg');
        }
    }
    // --- EVENT LISTENERS ---
    sendButton.addEventListener('click', handleSendOrCancelClick);
    sendButton.addEventListener('mousedown', handleButtonPress);
    sendButton.addEventListener('mouseup', handleButtonRelease);
    sendButton.addEventListener('mouseleave', handleButtonRelease);
    messageInput.addEventListener('keydown', handleKeydown);
    messageInput.addEventListener('input', () => { 
        autoResizeTextarea();
        updateInputUI(); 
    });
    fileUploadInput.addEventListener('change', handleFileUpload);
    attachmentBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAttachmentMenu();
    });

    document.addEventListener('click', () => {
        if (attachmentMenu.classList.contains('scale-100')) {
            toggleAttachmentMenu();
        }
    });
    
    takePhotoButton.addEventListener('click', openCamera);
    cancelCameraButton.addEventListener('click', closeCamera);
    capturePhotoButton.addEventListener('click', capturePhoto);

    setupSpeechRecognition();
    updateInputUI();

});