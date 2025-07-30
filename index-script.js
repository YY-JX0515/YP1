// 动漫数据可视化系统JavaScript功能实现

// 设置API基础URL
const API_BASE_URL = 'http://localhost:5001/api';

// 全局变量
let imageLoadQueue = [];
let maxConcurrentLoads = 4;
let currentLoading = 0;
let availableCovers = []; // 只在这里声明一次
const PHOTOS_DIR = 'D:/PythonProject1/photos'; // 本地图片目录路径

// 页面加载完成后执行初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化页面
    initializePage();
    
    // 设置活动导航项的高亮显示
    setupActiveNavigation();
});

// 页面初始化函数
function initializePage() {
    // 加载各类数据
    loadTVAnime();
    loadMovieAnime();
    loadRanking();
    loadHotRecommend();
    
    // 检查用户登录状态，如果已登录则加载个性化推荐
    checkUserLoginStatus();
}

// 设置活动导航项的高亮显示
function setupActiveNavigation() {
    // 获取所有导航链接
    const navItems = document.querySelectorAll('.nav-item, .vertical-nav-link');
    
    // 为每个导航链接添加点击事件
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // 移除所有链接的active类
            navItems.forEach(navItem => navItem.classList.remove('active'));
            
            // 为当前点击的链接添加active类
            this.classList.add('active');
            
            // 同步顶部和侧边栏的相应链接
            const href = this.getAttribute('href');
            document.querySelectorAll(`a[href="${href}"]`).forEach(link => {
                link.classList.add('active');
            });
        });
    });
    
    // 监听滚动事件，实现滚动时导航高亮显示对应区域
    window.addEventListener('scroll', function() {
        const sections = document.querySelectorAll('.section');
        let currentSection = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.offsetHeight;
            
            if (window.pageYOffset >= sectionTop && window.pageYOffset < sectionTop + sectionHeight) {
                currentSection = section.getAttribute('id');
            }
        });
        
        if (currentSection) {
            navItems.forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('href') === `#${currentSection}`) {
                    item.classList.add('active');
                }
            });
        }
    });
}

// TV版动漫加载函数
function loadTVAnime() {
    // 从后端API获取数据
    fetch(`${API_BASE_URL}/tv_anime`)
        .then(response => response.json())
        .then(data => {
            displayAnimeList(data, 'tv-anime-container');
        })
        .catch(error => {
            console.error('加载TV版动漫失败:', error);
            document.getElementById('tv-anime-container').innerHTML = 
                '<p class="error-message">加载数据失败，请稍后再试</p>';
        });
}

// 剧场版动漫加载函数
function loadMovieAnime() {
    // 从后端API获取数据
    fetch(`${API_BASE_URL}/movie_anime`)
        .then(response => response.json())
        .then(data => {
            displayAnimeList(data, 'movie-anime-container');
        })
        .catch(error => {
            console.error('加载剧场版动漫失败:', error);
            document.getElementById('movie-anime-container').innerHTML = 
                '<p class="error-message">加载数据失败，请稍后再试</p>';
        });
}

// 排行榜加载函数
function loadRanking() {
    const limit = document.getElementById('ranking-limit').value;
    const sortBy = document.getElementById('ranking-sort').value;
    
    // 从后端API获取数据
    fetch(`${API_BASE_URL}/ranking?limit=${limit}&sort=${sortBy}`)
        .then(response => response.json())
        .then(data => {
            displayAnimeList(data, 'ranking-container');
        })
        .catch(error => {
            console.error('加载排行榜失败:', error);
            document.getElementById('ranking-container').innerHTML = 
                '<p class="error-message">加载数据失败，请稍后再试</p>';
        });
}

// 热门推荐加载函数
function loadHotRecommend() {
    const limit = document.getElementById('hot-limit').value;
    
    // 从后端API获取数据
    fetch(`${API_BASE_URL}/hot_recommend?limit=${limit}`)
        .then(response => response.json())
        .then(data => {
            displayAnimeList(data, 'hot-container');
        })
        .catch(error => {
            console.error('加载热门推荐失败:', error);
            document.getElementById('hot-container').innerHTML = 
                '<p class="error-message">加载数据失败，请稍后再试</p>';
        });
}

// 个性化推荐加载函数
async function loadPersonalRecommend() {
    try {
        const userId = localStorage.getItem('user_id');
        if (!userId) {
            alert('请先登录以获取个性化推荐');
            return;
        }

        console.log('开始获取个性化推荐，用户ID:', userId);
        const response = await fetch(`${API_BASE_URL}/personal_recommend?user_id=${userId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('获取到的推荐数据:', result);
        
        if (result.status === 'error') {
            const container = document.getElementById('personal-container');
            container.innerHTML = `<div class="error-message">${result.message || '获取推荐失败，请稍后再试'}</div>`;
            return;
        }
        
        if (result.status === 'success' && Array.isArray(result.data)) {
            if (result.data.length === 0) {
                const container = document.getElementById('personal-container');
                container.innerHTML = '<div class="error-message">暂无推荐数据，请先收藏一些动漫或进行搜索</div>';
                return;
            }
            
            // 处理图片加载失败的情况
            const processedData = result.data.map(anime => {
                if (!anime.cover_url || anime.cover_url.includes('photos/')) {
                    anime.cover_url = getUniqueCover();
                }
                return anime;
            });
            
            displayAnimeList(processedData, 'personal-container');
        } else {
            console.error('个性化推荐数据格式错误:', result);
            const container = document.getElementById('personal-container');
            container.innerHTML = '<div class="error-message">获取个性化推荐失败，请稍后再试</div>';
        }
    } catch (error) {
        console.error('加载个性化推荐失败:', error);
        const container = document.getElementById('personal-container');
        container.innerHTML = `<div class="error-message">加载个性化推荐失败: ${error.message}</div>`;
    }
}

// 通用动漫列表显示函数
function displayAnimeList(animeList, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (!animeList || animeList.length === 0) {
        container.innerHTML = '<p class="error-message">暂无数据</p>';
        return;
    }
    
    animeList.forEach(anime => {
        const animeCard = createAnimeCard(anime);
        container.appendChild(animeCard);
    });
    
    // 在所有卡片添加完成后进行图片处理
    setupImageHandling();
}

// 添加图片到加载队列
function queueImageLoad(imgElement, imgSrc) {
    imageLoadQueue.push({ imgElement, imgSrc });
    processImageQueue();
}

// 处理图片加载队列
function processImageQueue() {
    // 如果当前加载的图片数小于最大值，继续加载队列中的图片
    while (currentLoading < maxConcurrentLoads && imageLoadQueue.length > 0) {
        const { imgElement, imgSrc } = imageLoadQueue.shift();
        currentLoading++;
        
        // 实际加载图片
        imgElement.src = imgSrc;
        
        // 图片加载完成后减少当前加载计数并继续处理队列
        imgElement.onload = function() {
            currentLoading--;
            // 图片加载完成后应用淡入效果
            this.style.opacity = '1';
            
            // 缓存成功加载的图片URL
            if (this.src && !this.src.includes('data:image/svg')) {
                if (!window.imgCache) window.imgCache = {};
                window.imgCache[this.src] = true;
            }
            
            // 继续处理队列
            processImageQueue();
        };
        
        // 图片加载失败处理
        imgElement.onerror = function() {
            currentLoading--;
            // 继续处理队列
            processImageQueue();
        };
    }
}

// 获取唯一的封面图片
function getUniqueCover() {
    // 如果可用封面列表为空，重新初始化
    if (availableCovers.length === 0) {
        // 获取本地目录中的图片数量
        const coverCount = 75; // 假设有75张封面图片
        availableCovers = Array.from({ length: coverCount }, (_, i) => i + 1);
    }
    
    // 随机选择一个封面索引
    const randomIndex = Math.floor(Math.random() * availableCovers.length);
    const selectedNumber = availableCovers.splice(randomIndex, 1)[0];
    
    // 使用API路径
    return `/api/photos/${selectedNumber}.png`;
}

// 修改创建动漫卡片函数，将图片加载部分替换为使用队列
function createAnimeCard(anime) {
    const card = document.createElement('div');
    card.classList.add('anime-card');
    
    // 封面容器
    const imageContainer = document.createElement('div');
    imageContainer.classList.add('anime-cover-container');
    
    // 创建图片元素
    const coverImg = document.createElement('img');
    coverImg.classList.add('anime-cover');
    coverImg.alt = anime.title;
    coverImg.style.opacity = '0'; // 初始透明，用于淡入效果
    coverImg.style.transition = 'opacity 0.3s ease'; // 添加平滑过渡效果
    
    // 为默认背景颜色添加样式
    imageContainer.style.backgroundColor = '#f5f5f5'; // 设置淡灰色背景
    
    // 图片加载失败处理
    coverImg.onerror = function() {
        // 防止循环引用
        this.onerror = null;
        
        // 使用本地photos目录中的随机图片
        const fallbackUrl = getUniqueCover();
        this.src = fallbackUrl;
    };
    
    // 将图片添加到容器
    imageContainer.appendChild(coverImg);
    card.appendChild(imageContainer);
    
    // 准备图片URL
    let imgSrc;
    if (anime.cover_url) {
        imgSrc = anime.cover_url;
    } else {
        imgSrc = getUniqueCover();
    }
    
    // 将图片添加到加载队列，而不是直接加载
    queueImageLoad(coverImg, imgSrc);
    
    // 信息容器
    const infoContainer = document.createElement('div');
    infoContainer.classList.add('anime-info');
    
    // 动漫标题
    const titleElement = document.createElement('h3');
    titleElement.classList.add('anime-title');
    titleElement.textContent = anime.title;
    
    // 根据标题长度设置字体大小
    if (anime.title.length > 40) {
        titleElement.setAttribute('data-length', 'very-long');
    } else if (anime.title.length > 20) {
        titleElement.setAttribute('data-length', 'long');
    }
    
    infoContainer.appendChild(titleElement);
    
    // 评分
    const scoreElement = document.createElement('div');
    scoreElement.classList.add('anime-detail');
    scoreElement.innerHTML = `<strong>评分:</strong> ${anime.score || 'N/A'}`;
    infoContainer.appendChild(scoreElement);
    
    // 类型
    const typeElement = document.createElement('div');
    typeElement.classList.add('anime-detail');
    typeElement.innerHTML = `<strong>类型:</strong> ${anime.type || 'Unknown'}`;
    infoContainer.appendChild(typeElement);
    
    // 标签/类型信息
    if (anime.genres) {
        const genresElement = document.createElement('div');
        genresElement.classList.add('anime-tags');
        
        let genres = [];
        try {
            // 处理可能的字符串或数组格式
            if (typeof anime.genres === 'string') {
                genres = anime.genres.split(',').map(g => g.trim()).filter(g => g);
            } else if (Array.isArray(anime.genres)) {
                genres = anime.genres;
            }
            
            // 只显示前3个标签
            genres = genres.slice(0, 3);
            
            if (genres.length > 0) {
                genresElement.innerHTML = `<strong>标签:</strong> ${genres.join(', ')}`;
                infoContainer.appendChild(genresElement);
            }
        } catch (e) {
            console.error('处理标签数据错误:', e);
        }
    }
    
    card.appendChild(infoContainer);
    
    // 按钮容器
    const actionContainer = document.createElement('div');
    actionContainer.classList.add('anime-actions');
    
    // 收藏按钮
    const favoriteBtn = document.createElement('button');
    favoriteBtn.classList.add('favorite-btn');
    favoriteBtn.setAttribute('data-anime-id', anime.id);
    favoriteBtn.innerHTML = '<i class="far fa-heart"></i> 收藏';
    
    // 检查是否已收藏
    checkIfFavorited(anime.id, function(isFavorited) {
        if (isFavorited) {
            favoriteBtn.classList.add('favorited');
            favoriteBtn.innerHTML = '<i class="fas fa-heart"></i> 已收藏';
        }
    });
    
    favoriteBtn.addEventListener('click', function() {
        if (favoriteBtn.classList.contains('favorited')) {
            unfavoriteAnime(anime.id);
            favoriteBtn.classList.remove('favorited');
            favoriteBtn.innerHTML = '<i class="far fa-heart"></i> 收藏';
        } else {
            favoriteAnime(anime.id);
            favoriteBtn.classList.add('favorited');
            favoriteBtn.innerHTML = '<i class="fas fa-heart"></i> 已收藏';
        }
    });
    actionContainer.appendChild(favoriteBtn);
    
    card.appendChild(actionContainer);
    
    return card;
}

// 查看动漫详情函数
function viewAnimeDetail(animeId) {
    window.location.href = `anime-detail.html?id=${animeId}`;
}

// 收藏动漫函数
function favoriteAnime(animeId) {
    const userId = getUserId();
    
    if (!userId) {
        alert('请先登录再收藏动漫');
        return;
    }
    
    // 发送请求到后端API
    fetch(`${API_BASE_URL}/favorite`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: userId,
            anime_id: animeId,
            action: 'add'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('收藏成功');
            // 更新按钮状态
            const favoriteBtn = document.querySelector(`.favorite-btn[data-anime-id="${animeId}"]`);
            if (favoriteBtn) {
                favoriteBtn.classList.add('favorited');
                favoriteBtn.innerHTML = '<i class="fas fa-heart"></i> 已收藏';
            }
        } else {
            alert(data.error || '收藏失败，请稍后再试');
        }
    })
    .catch(error => {
        console.error('收藏操作失败:', error);
        alert('收藏操作失败，请稍后再试');
    });
}

// 取消收藏动漫函数
function unfavoriteAnime(animeId) {
    const userId = getUserId();
    
    if (!userId) {
        alert('请先登录');
        return;
    }
    
    // 发送请求到后端API
    fetch(`${API_BASE_URL}/favorite`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: userId,
            anime_id: animeId,
            action: 'remove'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('已取消收藏');
            // 更新按钮状态
            const favoriteBtn = document.querySelector(`.favorite-btn[data-anime-id="${animeId}"]`);
            if (favoriteBtn) {
                favoriteBtn.classList.remove('favorited');
                favoriteBtn.innerHTML = '<i class="far fa-heart"></i> 收藏';
            }
        } else {
            alert(data.error || '取消收藏失败，请稍后再试');
        }
    })
    .catch(error => {
        console.error('取消收藏操作失败:', error);
        alert('取消收藏操作失败，请稍后再试');
    });
}

// 刷新TV版动漫列表
function refreshTVAnime() {
    loadTVAnime();
}

// 刷新剧场版动漫列表
function refreshMovieAnime() {
    loadMovieAnime();
}

// 搜索动漫函数
function searchAnime() {
    const searchTerm = document.getElementById('search-input').value.trim();
    const searchType = document.getElementById('search-type').value;
    
    if (!searchTerm) {
        alert('请输入搜索关键词');
        return;
    }
    
    // 保存搜索关键词和类型到sessionStorage
    sessionStorage.setItem('search_keyword', searchTerm);
    sessionStorage.setItem('search_type', searchType);
    
    // 保存当前用户ID到sessionStorage，确保搜索结果页能获取到用户身份
    const userId = localStorage.getItem('user_id');
    if (userId) {
        localStorage.setItem('user_id', userId);
    }
    
    // 跳转到搜索结果页面
    window.location.href = 'search-results.html';
}

// 回到顶部函数
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// 检查用户登录状态
function checkUserLoginStatus() {
    // 从本地存储或cookie中获取用户登录状态
    const userId = localStorage.getItem('user_id');
    
    // 更新用户中心链接显示
    const userCenterLink = document.querySelector('.user-center-link');
    if (userId) {
        userCenterLink.textContent = '个人中心';
        // 已登录，加载个性化推荐
        loadPersonalRecommend();
    } else {
        userCenterLink.textContent = '登录/注册';
    }
}

// 获取当前登录用户ID
function getUserId() {
    // 从本地存储或cookie中获取用户ID
    return localStorage.getItem('user_id');
}

// 模拟动漫数据（实际应用中会从后端API获取）
function getMockAnimeData(count = 5) {
    const mockData = [
        {
            id: 1,
            title: '鬼灭之刃',
            coverUrl: 'https://example.com/covers/kimetsu.jpg',
            score: 9.2,
            year: 2019,
            type: 'TV'
        },
        {
            id: 2,
            title: '进击的巨人',
            coverUrl: 'https://example.com/covers/shingeki.jpg',
            score: 9.0,
            year: 2013,
            type: 'TV'
        },
        {
            id: 3,
            title: '你的名字',
            coverUrl: 'https://example.com/covers/kiminonawa.jpg',
            score: 9.3,
            year: 2016,
            type: '剧场版'
        },
        {
            id: 4,
            title: '约定的梦幻岛',
            coverUrl: 'https://example.com/covers/yakusoku.jpg',
            score: 8.9,
            year: 2019,
            type: 'TV'
        },
        {
            id: 5,
            title: '辉夜大小姐想让我告白',
            coverUrl: 'https://example.com/covers/kaguya.jpg',
            score: 8.8,
            year: 2019,
            type: 'TV'
        },
        {
            id: 6,
            title: '天气之子',
            coverUrl: 'https://example.com/covers/tenkinoko.jpg',
            score: 8.7,
            year: 2019,
            type: '剧场版'
        },
        {
            id: 7,
            title: '命运石之门',
            coverUrl: 'https://example.com/covers/steinsgate.jpg',
            score: 9.1,
            year: 2011,
            type: 'TV'
        },
        {
            id: 8,
            title: '紫罗兰永恒花园',
            coverUrl: 'https://example.com/covers/violet.jpg',
            score: 8.9,
            year: 2018,
            type: 'TV'
        },
        {
            id: 9,
            title: '龙猫',
            coverUrl: 'https://example.com/covers/tonari.jpg',
            score: 9.2,
            year: 1988,
            type: '剧场版'
        },
        {
            id: 10,
            title: '总之就是非常可爱',
            coverUrl: 'https://example.com/covers/kawaii.jpg',
            score: 8.5,
            year: 2020,
            type: 'TV'
        }
    ];
    
    // 随机选择指定数量的动漫数据
    return mockData.sort(() => 0.5 - Math.random()).slice(0, count);
}

// 设置图片处理
function setupImageHandling() {
    // 初始化图片缓存对象
    if (!window.imgCache) {
        window.imgCache = {};
    }
    
    // 为所有未处理的动漫封面图片添加事件处理
    document.querySelectorAll('.anime-cover').forEach(img => {
        // 跳过已经设置过的图片
        if (img.hasAttribute('data-handled')) {
            return;
        }
        
        // 标记图片已处理
        img.setAttribute('data-handled', 'true');
        
        // 如果图片已经加载完成，直接显示
        if (img.complete && img.naturalHeight !== 0) {
            img.style.opacity = '1';
        } else if (!img.src || img.src === '') {
            // 如果图片没有源，添加到队列中加载
            const fallbackUrl = getUniqueCover();
            queueImageLoad(img, fallbackUrl);
        } else {
            // 如果图片已经有源但尚未加载完成，修改其onload和onerror事件
            const originalOnload = img.onload;
            img.onload = function() {
                // 执行原始onload
                if (originalOnload) originalOnload.call(this);
                
                // 添加到缓存
                if (this.src && !this.src.includes('data:image/svg')) {
                    window.imgCache[this.src] = true;
                }
                
                // 显示图片
                this.style.opacity = '1';
            };
            
            // 设置错误处理
            if (!img.hasAttribute('data-error-handler-set')) {
                img.setAttribute('data-error-handler-set', 'true');
                
                // 保存原始的onerror
                const originalOnerror = img.onerror;
                
                img.onerror = function() {
                    // 防止循环引用
                    this.onerror = null;
                    
                    // 尝试从本地获取随机图片
                    const fallbackUrl = getUniqueCover();
                    this.src = fallbackUrl;
                    
                    // 添加最终错误处理
                    this.onerror = function() {
                        this.onerror = null;
                        this.style.opacity = '1';
                        this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjI2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTgwIiBoZWlnaHQ9IjI2MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjkwIiB5PSIxMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzg4ODg4OCI+5peg5rOV5Yqg6L295Zu+54mHPC90ZXh0Pjwvc3ZnPg==';
                    };
                };
            }
        }
    });
    
    // 预加载随机图片，用于备用
    preloadRandomImages(5);
}

// 预加载随机图片函数
function preloadRandomImages(count) {
    // 避免重复预加载
    if (window.randomImagesPreloaded) return;
    window.randomImagesPreloaded = true;
    
    // 在后台预加载图片
    setTimeout(() => {
        for (let i = 0; i < count; i++) {
            const imageUrl = getUniqueCover();
            
            // 创建一个隐藏的图片元素来预加载
            const preloadImg = new Image();
            preloadImg.onload = function() {
                // 成功加载的图片URL加入缓存
                window.imgCache[imageUrl] = true;
            };
            preloadImg.src = imageUrl;
        }
    }, 1000); // 延迟1秒执行，不影响页面首次加载速度
}

/**
 * 检查动漫是否已被收藏
 * @param {number} animeId - 动漫ID
 * @param {function} callback - 回调函数，带有一个布尔参数表示是否已收藏
 */
function checkIfFavorited(animeId, callback) {
    const userId = getUserId();
    
    // 如果用户未登录，则默认为未收藏
    if (!userId) {
        callback(false);
        return;
    }
    
    // 检查是否已收藏
    fetch(`${API_BASE_URL}/check_favorite?user_id=${userId}&anime_id=${animeId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('检查收藏状态失败');
            }
            return response.json();
        })
        .then(data => {
            callback(data.is_favorited);
        })
        .catch(error => {
            console.error('检查收藏状态出错:', error);
            // 发生错误时默认为未收藏
            callback(false);
        });
} 