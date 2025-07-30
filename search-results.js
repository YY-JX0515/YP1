// search-results.js - Handles search and recommendation functionality

// Global variables
const API_BASE_URL = 'http://localhost:5001/api';
let currentUserID = null;
let userFavorites = [];
let currentSearchTerm = '';
let currentSearchType = '';

// Document ready event
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const searchForm = document.querySelector('.search-bar');
    const searchInput = document.querySelector('.search-bar input');
    const resultsContainer = document.querySelector('.results-grid');
    const recommendationsContainer = document.querySelector('.recommendations-grid');
    const loadingState = document.querySelector('.loading-state');
    const errorState = document.querySelector('.error-state');
    const resultsTitleElement = document.querySelector('#search-results-title');
    
    // Current search query from URL
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q') || 'Attack on Titan';
    searchInput.value = query;
    
    // Update the title with the search query
    resultsTitleElement.textContent = `Search Results for "${query}"`;
    
    // Mock anime data (in a real app, this would come from an API)
    const animeData = [
        {
            id: 1,
            title: 'Attack on Titan',
            image: 'https://via.placeholder.com/200x280?text=Attack+on+Titan',
            year: '2013',
            rating: 4.8,
            episodes: 75,
            description: 'In a world where humanity lives within cities surrounded by enormous walls due to the Titans, giant humanoid beings who devour people seemingly without reason.'
        },
        {
            id: 2,
            title: 'Attack on Titan: Junior High',
            image: 'https://via.placeholder.com/200x280?text=AoT+Junior+High',
            year: '2015',
            rating: 4.2,
            episodes: 12,
            description: 'A spin-off comedy series featuring the characters from Attack on Titan in a school setting.'
        },
        {
            id: 3,
            title: 'Attack on Titan: Chronicle',
            image: 'https://via.placeholder.com/200x280?text=AoT+Chronicle',
            year: '2020',
            rating: 4.5,
            episodes: 1,
            description: 'A compilation film recapping the events of the first three seasons of the Attack on Titan anime series.'
        },
        {
            id: 4,
            title: 'Attack on Titan: The Final Season',
            image: 'https://via.placeholder.com/200x280?text=AoT+Final+Season',
            year: '2020',
            rating: 4.9,
            episodes: 28,
            description: 'The final season of Attack on Titan, concluding the epic story of Eren, Mikasa, and Armin.'
        },
        {
            id: 5,
            title: 'Attack on Titan: No Regrets',
            image: 'https://via.placeholder.com/200x280?text=AoT+No+Regrets',
            year: '2014',
            rating: 4.6,
            episodes: 2,
            description: 'An OVA series focusing on Levi\'s backstory and how he joined the Survey Corps.'
        },
        {
            id: 6,
            title: 'Attack on Titan: Lost Girls',
            image: 'https://via.placeholder.com/200x280?text=AoT+Lost+Girls',
            year: '2017',
            rating: 4.4,
            episodes: 3,
            description: 'An OVA series featuring stories centered around Annie Leonhart and Mikasa Ackerman.'
        }
    ];
    
    // Recommended anime data
    const recommendedAnime = [
        {
            id: 7,
            title: 'Demon Slayer',
            image: 'https://via.placeholder.com/200x280?text=Demon+Slayer',
            year: '2019',
            rating: 4.7,
            episodes: 26,
            description: 'A boy whose family was killed by demons joins the Demon Slayer Corps to avenge his family and cure his sister.'
        },
        {
            id: 8,
            title: 'My Hero Academia',
            image: 'https://via.placeholder.com/200x280?text=My+Hero+Academia',
            year: '2016',
            rating: 4.6,
            episodes: 113,
            description: 'In a world where people with powers called "Quirks" are the norm, a boy born without one aims to become a hero.'
        },
        {
            id: 9,
            title: 'Jujutsu Kaisen',
            image: 'https://via.placeholder.com/200x280?text=Jujutsu+Kaisen',
            year: '2020',
            rating: 4.8,
            episodes: 24,
            description: 'A boy joins a secret organization of sorcerers to kill a powerful curse that he has inside him.'
        },
        {
            id: 10,
            title: 'Vinland Saga',
            image: 'https://via.placeholder.com/200x280?text=Vinland+Saga',
            year: '2019',
            rating: 4.7,
            episodes: 24,
            description: 'A young Viking seeks revenge for his father\'s death and finds himself in the middle of a war for the English crown.'
        }
    ];
    
    // Function to display loading state
    const showLoading = () => {
        loadingState.style.display = 'flex';
        resultsContainer.style.display = 'none';
        errorState.style.display = 'none';
    };
    
    // Function to display error state
    const showError = (message) => {
        loadingState.style.display = 'none';
        resultsContainer.style.display = 'none';
        errorState.style.display = 'block';
        
        const errorMessage = errorState.querySelector('p');
        errorMessage.textContent = message || 'An error occurred while fetching results. Please try again.';
    };
    
    // Function to display results
    const showResults = (results) => {
        loadingState.style.display = 'none';
        errorState.style.display = 'none';
        resultsContainer.style.display = 'grid';
        
        // Clear previous results
        resultsContainer.innerHTML = '';
        
        if (results.length === 0) {
            showError(`No results found for "${query}". Please try a different search term.`);
            return;
        }
        
        // Create and append anime cards
        results.forEach(anime => {
            const animeCard = createAnimeCard(anime);
            resultsContainer.appendChild(animeCard);
        });
    };
    
    // Function to create an anime card
    const createAnimeCard = (anime) => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        
        // Generate star rating HTML
        const fullStars = Math.floor(anime.rating);
        const halfStar = anime.rating % 1 >= 0.5;
        let starsHTML = '';
        
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                starsHTML += '★';
            } else if (i === fullStars && halfStar) {
                starsHTML += '★';
            } else {
                starsHTML += '☆';
            }
        }
        
        card.innerHTML = `
            <img src="${anime.image}" alt="${anime.title}">
            <div class="anime-card-content">
                <h3 class="anime-title">${anime.title}</h3>
                <div class="anime-info">${anime.year} • ${anime.episodes} episodes</div>
                <div class="anime-rating">
                    <span class="rating-stars">${starsHTML}</span>
                    <span>${anime.rating.toFixed(1)}</span>
                </div>
                <p class="anime-description">${anime.description}</p>
                <div class="card-actions">
                    <button class="watch-btn">Watch Now</button>
                    <button class="add-list-btn">+ My List</button>
                </div>
            </div>
        `;
        
        return card;
    };
    
    // Function to display recommendations
    const showRecommendations = (recommendations) => {
        // Clear previous recommendations
        recommendationsContainer.innerHTML = '';
        
        // Create and append recommendation cards
        recommendations.forEach(anime => {
            const animeCard = createAnimeCard(anime);
            recommendationsContainer.appendChild(animeCard);
        });
    };
    
    // Function to handle search
    const handleSearch = (e) => {
        e.preventDefault();
        const searchValue = searchInput.value.trim();
        
        if (searchValue) {
            // Redirect to search results page with search query
            window.location.href = `search-results.html?q=${encodeURIComponent(searchValue)}`;
        }
    };
    
    // Initialize the page
    const initPage = () => {
        // Add event listener for search form
        searchForm.addEventListener('submit', handleSearch);
        
        // Simulate API call with loading state
        showLoading();
        
        // Simulate network delay
        setTimeout(() => {
            // Filter anime data based on search query
            const filteredResults = animeData.filter(anime => 
                anime.title.toLowerCase().includes(query.toLowerCase())
            );
            
            // Show results and recommendations
            showResults(filteredResults);
            showRecommendations(recommendedAnime);
            
            // Add click event listeners to all buttons
            addButtonListeners();
        }, 1500); // Simulate 1.5s loading time
    };
    
    // Add event listeners to buttons
    const addButtonListeners = () => {
        // Watch Now buttons
        document.querySelectorAll('.watch-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const card = e.target.closest('.anime-card');
                const title = card.querySelector('.anime-title').textContent;
                alert(`Starting playback: ${title}`);
            });
        });
        
        // Add to My List buttons
        document.querySelectorAll('.add-list-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const card = e.target.closest('.anime-card');
                const title = card.querySelector('.anime-title').textContent;
                
                // Toggle button text and style
                if (button.textContent === '+ My List') {
                    button.textContent = '✓ Added';
                    button.style.backgroundColor = '#4CAF50';
                    alert(`${title} added to your list!`);
                } else {
                    button.textContent = '+ My List';
                    button.style.backgroundColor = '';
                    alert(`${title} removed from your list!`);
                }
            });
        });
    };
    
    // Initialize the page
    initPage();
});

// Check if user is logged in
function checkLoginStatus() {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('user_id');
    
    if (!userId) {
        // Not logged in, redirect to login page
        window.location.href = 'login.html';
        return;
    }
    
    // Save user ID
    currentUserID = userId;
    
    // Get user favorites
    fetchUserFavorites();
    
    // Perform search
    performSearch();
    
    // Load personal recommendations
    loadPersonalRecommendations();
}

// Get user favorites
function fetchUserFavorites() {
    if (!currentUserID) return;
    
    fetch(`${API_BASE_URL}/user_favorites?user_id=${currentUserID}`)
        .then(response => response.json())
        .then(data => {
            userFavorites = data.favorites || [];
        })
        .catch(error => {
            console.error('Failed to get favorites:', error);
        });
}

// Perform search
function performSearch() {
    const keyword = sessionStorage.getItem('search_keyword');
    const searchType = sessionStorage.getItem('search_type');
    
    if (!keyword) {
        document.getElementById('results-container').innerHTML = 
            '<div class="error-message">Search keyword is empty, please return to homepage</div>';
        return;
    }
    
    // Save current search parameters
    currentSearchTerm = keyword;
    currentSearchType = searchType;
    
    // Update search info display
    document.getElementById('search-info').textContent = `Search Type: ${getSearchTypeName(searchType)} | Keyword: ${keyword}`;
    
    // Execute API call with user_id parameter
    fetch(`${API_BASE_URL}/search?term=${encodeURIComponent(keyword)}&type=${searchType}&user_id=${currentUserID}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                document.getElementById('results-count').textContent = data.length;
                renderSearchResults(data);
            } else {
                document.getElementById('results-container').innerHTML = 
                    '<div class="error-message">No matching anime found, please try other keywords</div>';
            }
        })
        .catch(error => {
            console.error('Search failed:', error);
            document.getElementById('results-container').innerHTML = 
                '<div class="error-message">Search failed, please try again later</div>';
        });
}

// Get search type name for display
function getSearchTypeName(searchType) {
    switch (searchType) {
        case 'title': return 'Title';
        case 'genre': return 'Genre';
        case 'studio': return 'Studio';
        default: return 'Title';
    }
}

// Setup image error handling
function setupImageErrorHandling() {
    document.querySelectorAll('.anime-cover').forEach(img => {
        if (!img.hasAttribute('data-error-handler-set')) {
            img.setAttribute('data-error-handler-set', 'true');
            
            // Add load complete handler
            img.onload = function() {
                this.style.opacity = '1';
            };
            
            img.onerror = function() {
                this.onerror = null;
                const timestamp = new Date().getTime();
                const randomNum = Math.floor(Math.random() * 75) + 1;
                this.src = `http://localhost:5001/photos/${randomNum}.png?t=${timestamp}`;
            };
        }
    });
}

// Get unique cover image URL
function getUniqueCover() {
    const coverCount = 75;
    const randomNum = Math.floor(Math.random() * coverCount) + 1;
    const timestamp = new Date().getTime();
    return `http://localhost:5001/photos/${randomNum}.png?t=${timestamp}`;
}

// Render search results
function renderSearchResults(results) {
    const container = document.getElementById('results-container');
    container.innerHTML = '';
    
    results.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        
        // Check if already favorited
        const isFavorite = userFavorites.some(fav => fav.anime_id === anime.id);
        
        // Prepare tags HTML
        let genresHTML = '';
        if (anime.genres && anime.genres.length > 0) {
            const genresList = typeof anime.genres === 'string' ? anime.genres.split(',') : anime.genres;
            genresHTML = '<div class="tag-container">' + 
                genresList.map(genre => `<span class="tag">${genre}</span>`).join('') + 
                '</div>';
        }
        
        let studiosHTML = '';
        if (anime.studios && anime.studios.length > 0) {
            const studiosList = typeof anime.studios === 'string' ? anime.studios.split(',') : anime.studios;
            studiosHTML = '<div class="tag-container">' + 
                studiosList.map(studio => `<span class="tag">${studio}</span>`).join('') + 
                '</div>';
        }
        
        // Get cover URL
        let coverUrl;
        if (anime.cover) {
            coverUrl = anime.cover;
        } else {
            const timestamp = new Date().getTime();
            const randomNum = Math.floor(Math.random() * 75) + 1;
            coverUrl = `http://localhost:5001/photos/${randomNum}.png?t=${timestamp}`;
        }
        
        card.innerHTML = `
            <div class="anime-cover-container">
                <img src="${coverUrl}" alt="${anime.title}" class="anime-cover" 
                     onerror="this.onerror=null; this.src=getUniqueCover();"
                     onclick="recordClick(${anime.id})">
            </div>
            <div class="anime-info" onclick="recordClick(${anime.id})">
                <div class="anime-title">${anime.title}</div>
                <div class="anime-detail"><strong>ID:</strong> ${anime.id}</div>
                <div class="anime-detail"><strong>Score:</strong> ${anime.score || 'None'}</div>
                <div class="anime-detail"><strong>Type:</strong> ${anime.type || 'Unknown'}</div>
                <div class="anime-detail"><strong>Episodes:</strong> ${anime.episodes || 'Unknown'}</div>
                <div class="anime-detail"><strong>Popularity:</strong> ${anime.members ? anime.members.toLocaleString() : 'Unknown'}</div>
                <div class="anime-detail"><strong>Rank:</strong> ${anime.rank || 'Unknown'}</div>
                <div class="anime-detail"><strong>Popularity:</strong> ${anime.popularity || 'Unknown'}</div>
                ${genresHTML ? `<div class="anime-detail"><strong>Genres:</strong>${genresHTML}</div>` : ''}
                ${studiosHTML ? `<div class="anime-detail"><strong>Studios:</strong>${studiosHTML}</div>` : ''}
            </div>
            <div class="action-buttons">
                ${isFavorite 
                    ? `<button onclick="removeFromFavorites(${anime.id})">Remove from favorites</button>` 
                    : `<button onclick="addToFavorites(${anime.id})">Add to favorites</button>`
                }
            </div>
        `;
        
        container.appendChild(card);
    });
    
    // Setup error handling for new images
    setupImageErrorHandling();
}

// Record click event for personalization
function recordClick(animeId) {
    if (!currentUserID || !currentSearchTerm || !animeId) return;
    
    // Record the click using the API
    fetch(`${API_BASE_URL}/record_click`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: currentUserID,
            search_term: currentSearchTerm,
            anime_id: animeId
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Click recorded:', data);
    })
    .catch(error => {
        console.error('Failed to record click:', error);
    });
}

// Load personal recommendations
function loadPersonalRecommendations() {
    if (!currentUserID) {
        document.getElementById('recommendations-container').innerHTML = 
            '<div class="error-message">请先登录以获取个性化推荐</div>';
        return;
    }
    
    // 显示加载动画
    document.getElementById('recommendation-loading').style.display = 'inline-block';
    document.getElementById('recommendations-container').innerHTML = 
        '<div class="loading-message">正在为您生成个性化推荐...</div>';
    
    // 从后端API获取数据
    fetch(`${API_BASE_URL}/personal_recommend?user_id=${currentUserID}`)
        .then(response => response.json())
        .then(data => {
            // 隐藏加载动画
            document.getElementById('recommendation-loading').style.display = 'none';
            
            if (data.status === 'success' && data.data && data.data.length > 0) {
                renderRecommendations(data.data);
            } else {
                document.getElementById('recommendations-container').innerHTML = 
                    '<div class="error-message">暂无推荐，请先收藏一些动漫</div>';
            }
        })
        .catch(error => {
            console.error('加载个性化推荐失败:', error);
            // 隐藏加载动画
            document.getElementById('recommendation-loading').style.display = 'none';
            document.getElementById('recommendations-container').innerHTML = 
                '<div class="error-message">加载个性化推荐失败，请稍后再试</div>';
        });
}

// Render recommendation results
function renderRecommendations(results) {
    const container = document.getElementById('recommendations-container');
    container.innerHTML = '';
    
    results.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        
        // Check if already favorited
        const isFavorite = userFavorites.some(fav => fav.anime_id === anime.id);
        
        // Prepare tags HTML
        let genresHTML = '';
        if (anime.genres && anime.genres.length > 0) {
            const genresList = typeof anime.genres === 'string' ? anime.genres.split(',') : anime.genres;
            genresHTML = '<div class="tag-container">' + 
                genresList.map(genre => `<span class="tag">${genre}</span>`).join('') + 
                '</div>';
        }
        
        let studiosHTML = '';
        if (anime.studios && anime.studios.length > 0) {
            const studiosList = typeof anime.studios === 'string' ? anime.studios.split(',') : anime.studios;
            studiosHTML = '<div class="tag-container">' + 
                studiosList.map(studio => `<span class="tag">${studio}</span>`).join('') + 
                '</div>';
        }
        
        // Get cover URL
        let coverUrl;
        if (anime.cover) {
            coverUrl = anime.cover;
        } else {
            const timestamp = new Date().getTime();
            const randomNum = Math.floor(Math.random() * 75) + 1;
            coverUrl = `http://localhost:5001/photos/${randomNum}.png?t=${timestamp}`;
        }
        
        card.innerHTML = `
            <div class="anime-cover-container">
                <img src="${coverUrl}" alt="${anime.title}" class="anime-cover" 
                     onerror="this.onerror=null; this.src=getUniqueCover();">
            </div>
            <div class="anime-info">
                <div class="anime-title">${anime.title}</div>
                <div class="anime-detail"><strong>ID:</strong> ${anime.id}</div>
                <div class="anime-detail"><strong>Score:</strong> ${anime.score || 'None'}</div>
                <div class="anime-detail"><strong>Type:</strong> ${anime.type || 'Unknown'}</div>
                ${genresHTML ? `<div class="anime-detail"><strong>Genres:</strong>${genresHTML}</div>` : ''}
                ${studiosHTML ? `<div class="anime-detail"><strong>Studios:</strong>${studiosHTML}</div>` : ''}
            </div>
            <div class="action-buttons">
                ${isFavorite 
                    ? `<button onclick="removeFromFavorites(${anime.id})">Remove from favorites</button>` 
                    : `<button onclick="addToFavorites(${anime.id})">Add to favorites</button>`
                }
            </div>
        `;
        
        container.appendChild(card);
    });
    
    // Setup error handling for new images
    setupImageErrorHandling();
}

// Add to favorites
function addToFavorites(animeId) {
    if (!currentUserID) {
        alert('Please login first');
        return;
    }
    
    // Show loading state
    const buttons = document.querySelectorAll(`button[onclick="addToFavorites(${animeId})"]`);
    buttons.forEach(btn => {
        btn.disabled = true;
        btn.textContent = 'Adding...';
    });
    
    const requestData = {
        user_id: currentUserID,
        anime_id: animeId
    };
    
    console.log('Sending favorite request:', requestData);
    
    fetch(`${API_BASE_URL}/favorite`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        console.log('Favorite response status:', response.status);
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || data.details || `Server error(${response.status})`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Favorite response data:', data);
        if (data.message) {
            alert(data.message);
            // Refresh favorites list, search results and recommendations
            fetchUserFavorites();
            setTimeout(() => {
                performSearch();
                loadPersonalRecommendations();
            }, 500);
        } else if (data.error) {
            throw new Error(data.error);
        }
    })
    .catch(error => {
        console.error('Favorite failed details:', error);
        // Restore button state
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.textContent = 'Add to favorites';
        });
        
        alert(`Failed to add favorite: ${error.message || 'Unknown error, please try again later'}`);
    });
}

// Remove from favorites
function removeFromFavorites(animeId) {
    if (!currentUserID) {
        alert('Please login first');
        return;
    }
    
    // Show loading state
    const buttons = document.querySelectorAll(`button[onclick="removeFromFavorites(${animeId})"]`);
    buttons.forEach(btn => {
        btn.disabled = true;
        btn.textContent = 'Removing...';
    });
    
    const requestData = {
        user_id: currentUserID,
        anime_id: animeId
    };
    
    console.log('Sending unfavorite request:', requestData);
    
    fetch(`${API_BASE_URL}/favorite`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        console.log('Unfavorite response status:', response.status);
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || data.details || `Server error(${response.status})`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Unfavorite response data:', data);
        if (data.message) {
            alert(data.message);
            // Refresh favorites list, search results and recommendations
            fetchUserFavorites();
            setTimeout(() => {
                performSearch();
                loadPersonalRecommendations();
            }, 500);
        } else if (data.error) {
            throw new Error(data.error);
        }
    })
    .catch(error => {
        console.error('Unfavorite failed details:', error);
        // Restore button state
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.textContent = 'Remove from favorites';
        });
        
        alert(`Failed to remove favorite: ${error.message || 'Unknown error, please try again later'}`);
    });
}

// Check database connection status
function checkDatabaseConnection() {
    fetch(`${API_BASE_URL}/check_connection`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'connected') {
                console.log('Database connection normal');
            } else {
                console.error('Database connection abnormal:', data.message);
            }
        })
        .catch(error => {
            console.error('Failed to check database connection:', error);
        });
}

// Check database connection on page load
setTimeout(checkDatabaseConnection, 1000);

// Function to update the search information in the header
function updateSearchInfo(query, type) {
    const searchInfoElement = document.getElementById('search-info');
    if (searchInfoElement) {
        let typeText = '';
        
        switch(type) {
            case 'title':
                typeText = 'Title';
                break;
            case 'genre':
                typeText = 'Genre';
                break;
            case 'studio':
                typeText = 'Studio';
                break;
            default:
                typeText = 'Keyword';
        }
        
        searchInfoElement.textContent = `Search ${typeText}: "${query}"`;
    }
}

// Function to fetch search results from the API
function fetchSearchResults(query, type) {
    const resultsContainer = document.getElementById('results-container');
    const resultsCountElement = document.getElementById('results-count');
    
    // Display loading message
    resultsContainer.innerHTML = '<div class="loading-message">Loading search results... <img src="loading.gif" class="loading-icon" alt="Loading"></div>';
    
    // Simulate API call with setTimeout (replace with actual fetch in production)
    setTimeout(() => {
        // For demonstration - replace with actual API fetch
        fetch(`http://localhost:5001/api/search?query=${encodeURIComponent(query)}&type=${type}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Update results count
                const resultCount = data.length || 0;
                resultsCountElement.textContent = resultCount;
                
                // Clear loading message
                resultsContainer.innerHTML = '';
                
                if (resultCount === 0) {
                    resultsContainer.innerHTML = '<div class="error-message">No results found for your search. Try different keywords.</div>';
                    return;
                }
                
                // Create the results grid
                const resultsGrid = document.createElement('div');
                resultsGrid.className = 'results-grid';
                
                // Add each anime to the grid
                data.forEach(anime => {
                    const animeCard = createAnimeCard(anime);
                    resultsGrid.appendChild(animeCard);
                });
                
                // Append the grid to the container
                resultsContainer.appendChild(resultsGrid);
                
                // Animate images loading with fade-in effect
                setTimeout(() => {
                    const images = document.querySelectorAll('.anime-cover');
                    images.forEach(img => {
                        img.style.opacity = '1';
                    });
                }, 100);
            })
            .catch(error => {
                console.error('Error fetching search results:', error);
                resultsContainer.innerHTML = `<div class="error-message">Error loading results: ${error.message}</div>`;
            });
    }, 500); // Simulated delay - remove in production
}

// Function to create an anime card element
function createAnimeCard(anime) {
    const card = document.createElement('div');
    card.className = 'anime-card';
    
    // Create cover image container
    const coverContainer = document.createElement('div');
    coverContainer.className = 'anime-cover-container';
    
    // Create cover image
    const coverImg = document.createElement('img');
    coverImg.className = 'anime-cover';
    coverImg.src = anime.image_url || 'default-anime-cover.jpg';
    coverImg.alt = anime.title || 'Anime cover';
    coverImg.loading = 'lazy'; // Lazy load images
    
    // Handle image error
    coverImg.onerror = function() {
        this.src = 'default-anime-cover.jpg';
    };
    
    coverContainer.appendChild(coverImg);
    card.appendChild(coverContainer);
    
    // Create info section
    const infoSection = document.createElement('div');
    infoSection.className = 'anime-info';
    
    // Add title
    const title = document.createElement('div');
    title.className = 'anime-title';
    title.textContent = anime.title || 'Unknown Anime';
    infoSection.appendChild(title);
    
    // Add details
    if (anime.year) {
        const year = document.createElement('div');
        year.className = 'anime-detail';
        year.textContent = `Year: ${anime.year}`;
        infoSection.appendChild(year);
    }
    
    if (anime.score) {
        const score = document.createElement('div');
        score.className = 'anime-detail';
        score.textContent = `Score: ${anime.score}`;
        infoSection.appendChild(score);
    }
    
    if (anime.genres && anime.genres.length > 0) {
        const tagContainer = document.createElement('div');
        tagContainer.className = 'tag-container';
        
        anime.genres.slice(0, 3).forEach(genre => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = genre;
            tagContainer.appendChild(tag);
        });
        
        infoSection.appendChild(tagContainer);
    }
    
    card.appendChild(infoSection);
    
    // Add action buttons
    const actionButtons = document.createElement('div');
    actionButtons.className = 'action-buttons';
    
    const detailsButton = document.createElement('button');
    detailsButton.textContent = 'View Details';
    detailsButton.addEventListener('click', function() {
        window.location.href = `anime-details.html?id=${anime.id}`;
    });
    
    actionButtons.appendChild(detailsButton);
    card.appendChild(actionButtons);
    
    return card;
}

// Function to fetch recommendations based on the search query
function fetchRecommendations(query) {
    const recommendationsContainer = document.getElementById('recommendations-container');
    
    // Display loading message
    recommendationsContainer.innerHTML = '<div class="loading-message">Loading recommendations... <img src="loading.gif" class="loading-icon" alt="Loading"></div>';
    
    // Simulate API call with setTimeout (replace with actual fetch in production)
    setTimeout(() => {
        // For demonstration - replace with actual API fetch
        fetch(`http://localhost:5001/api/recommendations?query=${encodeURIComponent(query)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Clear loading message
                recommendationsContainer.innerHTML = '';
                
                if (!data || data.length === 0) {
                    recommendationsContainer.innerHTML = '<div class="error-message">No recommendations available.</div>';
                    return;
                }
                
                // Create the recommendations grid
                const recommendationsGrid = document.createElement('div');
                recommendationsGrid.className = 'results-grid';
                
                // Add each recommended anime to the grid
                data.slice(0, 4).forEach(anime => {
                    const animeCard = createAnimeCard(anime);
                    recommendationsGrid.appendChild(animeCard);
                });
                
                // Append the grid to the container
                recommendationsContainer.appendChild(recommendationsGrid);
                
                // Animate images loading with fade-in effect
                setTimeout(() => {
                    const images = document.querySelectorAll('.anime-cover');
                    images.forEach(img => {
                        if (img.style.opacity !== '1') {
                            img.style.opacity = '1';
                        }
                    });
                }, 100);
            })
            .catch(error => {
                console.error('Error fetching recommendations:', error);
                recommendationsContainer.innerHTML = `<div class="error-message">Error loading recommendations: ${error.message}</div>`;
            });
    }, 800); // Simulated delay - remove in production
} 