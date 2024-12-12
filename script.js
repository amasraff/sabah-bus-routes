let selectedcity = 'kota kinabalu';

        function initialize() {
            fetch('city.json')
                .then(response => response.json())
                .then(data => {
                    createcityButtons(data.city);
                   // setCity('kota kinabalu'); // Set default city
                })
                .catch(error => console.error('Error fetching list:', error));
        }

        function createcityButtons(city) {
            const cityButtons = document.getElementById('cityButtons');
            cityButtons.innerHTML = '';
            Object.keys(city).forEach(city => {
                const button = document.createElement('button');
                button.innerText = city.toUpperCase();
                button.onclick = () => setCity(city);
                cityButtons.appendChild(button);
            });
        }

        function setCity(city) {
            selectedcity = city;
            loadLanguageData();
        }

        function loadLanguageData() {
            fetch('lang.json')
                .then(response => response.json())
                .then(data => {
                    createJsonButtons(data.city[selectedLanguage]);
                })
                .catch(error => console.error('Error fetching language data:', error));
        }

        function createJsonButtons(languageData) {
            const jsonButtons = document.getElementById('jsonButtons');
            jsonButtons.innerHTML = '';
            languageData.forEach(item => {
                const button = document.createElement('button');
                button.innerText = item.label;
                button.onclick = () => loadData(item.fileName);
                jsonButtons.appendChild(button);
            });
        }

function loadData(fileName) {
	fetch(fileName)
		.then(response => response.json())
		.then(data => {
			document.getElementById('pageTitle').innerText = data.region;
			document.getElementById('pageDescription').innerText = data.description;
			document.getElementById('map').src = data.map;
			const content = document.getElementById('content');
			content.innerHTML = '';

			data.buses.forEach(route => {
				const routeDiv = document.createElement('div');
				routeDiv.classList.add('route');

				// Add bus name
				const categoryTitle = document.createElement('strong');
				categoryTitle.innerText = `${route.busNumber}: `;
				routeDiv.appendChild(categoryTitle);

				// Add link to route
				route.towards.forEach((heads, index) => {
					const headSpan = document.createElement('span');
					headSpan.classList.add('heads');
					headSpan.innerHTML = `<a href="${heads.route}">${heads.destination} [${heads.notes}]<a>`;
					routeDiv.appendChild(headSpan);
					
					if (index === 0) { //insert custom text before second
						const customTextDiv = document.createElement('span');
						customTextDiv.innerText = ' <=> ';
						routeDiv.appendChild(customTextDiv);
					}
                    });

					// Add remarks section
                        const remarksSpan = document.createElement('span');
                        remarksSpan.classList.add('remark');
                        remarksSpan.innerText = route.remark;
                        routeDiv.appendChild(remarksSpan);
				content.appendChild(routeDiv);
			});
		})
		.catch(error => console.error('Error fetching data:', error));
}
// Initialize buttons for the default language
initialize();
