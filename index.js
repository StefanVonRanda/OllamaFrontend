const input = document.querySelector('input[type="text"]');
const send = document.querySelector('input[type="submit"]');
const form = document.querySelector('form');
const models = document.querySelector('select');
let currentModel;

const url = 'http://localhost:11434/api/chat';
const data = {
  model: 'openhermes2.5-mistral:7b-q4_K_M',
  messages: [
    {
      "role": "user",
      "content": "why is the sky blue?"
    }
  ],
  "stream": false
};

window.onload = () => {
	fetch('http://localhost:11434/api/tags')
	.then(response => { return response.json(); })
	.then(data => {
		data.models.forEach((m) => {
			const opt = document.createElement('option');
			opt.value = m.name;
			opt.innerHTML = m.name;
			models.add(opt);
		});
		currentModel = models.options[0].value;
	});

}

models.onchange = (e) => {
	currentModel = models.options[models.selectedIndex].value;
}

send.onclick = () => {
	send.value = "autorenew"
	send.disabled = true;
	input.readOnly = true;

	data.messages[0].content = input.value;
	data.model = currentModel;
	fetch(url, {
		method: 'POST',
		body: JSON.stringify(data),
		headers: {
			'Content-Type': 'application/json'
		}
	})
	.then(response => {
		if (!response.ok) {
			throw new Error('Network response was not ok');
		}
		return response.json();
	})
	.then(data => {
		document.querySelector('.responses').innerHTML += `<div class="request"><div class="author">user:</div><div class="message">${input.value}</div></div><div class="response"><div class="author">${currentModel.split(':')[0]}:</div><div class="message">${data.message.content}</div></div>`;
		send.value = 'send';
		send.disabled = false;
		input.readOnly = false;
		input.value = '';
	})
	.catch(error => {
		console.error('There was a problem with your fetch operation:', error);
	});
}
