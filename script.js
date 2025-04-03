import { parseMd } from './markdown.js';

const input = document.querySelector('input[type="text"]');
const send = document.querySelector('input[type="submit"]');
const models = document.querySelector('select');
const responsesContainer = document.querySelector('.responses');
let currentModel;

const url = 'http://localhost:11434/api/chat';

// --- Helper function to safely append text ---
function escapeHTML(str) {
	const div = document.createElement('div');
	div.appendChild(document.createTextNode(str));
	return div.innerHTML;
}

// --- Load Models on Startup ---
window.onload = () => {
	fetch('http://localhost:11434/api/tags')
		.then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response.json();
		})
		.then(data => {
			if (data.models && Array.isArray(data.models)) {
				data.models.forEach((m) => {
					const opt = document.createElement('option');
					opt.value = m.name;
					opt.innerHTML = m.name.includes(':') ? m.name.split(':')[0] : m.name;
					models.add(opt);
				});
				if (models.options.length > 0) {
					currentModel = models.options[0].value;
				} else {
					console.warn("No Ollama models found.");
				}
			} else {
				console.error("Unexpected response format for models:", data);
			}
		})
		.catch(error => {
			console.error('Error fetching models:', error);
			responsesContainer.innerHTML += `<div class="error">Error fetching models: ${error.message}. Is Ollama running?</div>`;
		});

	input.focus();
};

// --- Model Selection Change ---
models.onchange = (e) => {
	currentModel = models.options[models.selectedIndex].value;
};

// --- Send Request (Streaming) ---
send.onclick = async () => {
	const userMessage = input.value.trim();
	if (!userMessage || !currentModel) {
		console.warn("No message entered or no model selected.");
		return;
	}

	// Disable UI
	send.value = "autorenew";
	send.disabled = true;
	input.readOnly = true;

	// --- Prepare Request Data ---
	const data = {
		model: currentModel,
		messages: [
			{
				"role": "user",
				"content": userMessage
			}
		],
		"stream": true
	};

	// --- Create UI Elements for Request and Response ---
	const modelName = currentModel.split(':')[0]; // Get clean model name once

	// Add Request HTML using template literal
	responsesContainer.insertAdjacentHTML('beforeend', `
		<div class="request">
				<div class="author">user:</div>
				<div class="message">${escapeHTML(userMessage)}</div>
		</div>
`);

	// Add Response structure HTML using template literal
	responsesContainer.insertAdjacentHTML('beforeend', `
		<div class="response">
				<div class="author">${escapeHTML(modelName)}:</div>
				<div class="message">|</div>
		</div>
`);

	// Get a reference to the message element *of the last added response*
	// This is crucial for updating during streaming
	const responseMessageDiv = responsesContainer.querySelector('.response:last-child .message');

	// Scroll to bottom
	responsesContainer.scrollTop = responsesContainer.scrollHeight;

	// --- Clear Input ---
	input.value = '';

	// --- Process Stream ---
	let accumulatedContent = '';
	let firstChunk = true;

	try {
		const response = await fetch(url, {
			method: 'POST',
			body: JSON.stringify(data),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			let errorBody = `HTTP error! status: ${response.status}`;
			try {
				const errorJson = await response.json();
				errorBody = errorJson.error || JSON.stringify(errorJson);
			} catch (e) { /* Ignore parsing error, use status */ }
			throw new Error(errorBody);
		}

		if (!response.body) {
			throw new Error("Response body is null");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { value, done } = await reader.read();

			if (done) {
				// End of stream
				break;
			}

			// Decode the chunk and add to buffer
			buffer += decoder.decode(value, { stream: true });

			// Process lines separated by newline
			let lines = buffer.split('\n');

			// Keep the last potentially incomplete line in the buffer
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (!line.trim()) continue;

				try {
					const chunkJson = JSON.parse(line);

					if (chunkJson.message && chunkJson.message.content) {
						const contentChunk = chunkJson.message.content;
						accumulatedContent += contentChunk;

						if (firstChunk) {
							responseMessageDiv.innerHTML = '';
							firstChunk = false;
						}

						// Append raw text directly for speed. Escape basic HTML.
						responseMessageDiv.innerHTML += escapeHTML(contentChunk);
						responsesContainer.scrollTop = responsesContainer.scrollHeight;
					}

					// Check if Ollama signals it's done with *this* response
					if (chunkJson.done) {
						console.log("Ollama indicated completion.", chunkJson);
					}
				} catch (err) {
					console.warn("Failed to parse JSON chunk:", line, err);
				}
			}
		}
		buffer += decoder.decode();
		let lines = buffer.split('\n');
		for (const line of lines) {
			if (!line.trim()) continue;
			try {
				const chunkJson = JSON.parse(line);
				if (chunkJson.message && chunkJson.message.content) {
					const contentChunk = chunkJson.message.content;
					accumulatedContent += contentChunk;
					if (firstChunk) {
						responseMessageDiv.innerHTML = '';
						firstChunk = false;
					}
					responseMessageDiv.innerHTML += escapeHTML(contentChunk);
				}
			} catch (err) {/* ignore */ }
		}


		// --- Final Markdown Parsing ---
		responseMessageDiv.innerHTML = parseMd(accumulatedContent);
		responsesContainer.scrollTop = responsesContainer.scrollHeight;


	} catch (error) {
		console.error('Error during fetch or streaming:', error);
		if (firstChunk) {
			responseMessageDiv.innerHTML = '';
		}
		responseMessageDiv.innerHTML += `<div class="error">Error: ${escapeHTML(error.message)}</div>`;
		responsesContainer.scrollTop = responsesContainer.scrollHeight;
	} finally {
		// --- Re-enable UI ---
		send.value = 'send';
		send.disabled = false;
		input.readOnly = false;
		input.focus();
	}
};

input.addEventListener('keypress', function (e) {
	if (e.key === 'Enter' && !send.disabled) {
		send.onclick();
	}
});