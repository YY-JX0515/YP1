// 全局变量
const API_BASE_URL = 'http://localhost:5001';  // 更新为Flask后端端口
let usedCovers = new Set(); // 用于追踪已使用的封面
let availableCovers = []; // 存储可用的封面索引
let currentUserID = null;
let userFavorites = []; // 确保初始化为空数组
let currentChartIndex = 0; // 当前显示的图表索引
let currentReportData = null; // 存储当前报告数据

// 收藏列表分页相关变量
let currentPage = 1; // 当前页码
const itemsPerPage = 10; // 每页显示的动漫数量
let totalPages = 1; // 总页数

// 页面加载时检查登录状态并初始化
document.addEventListener('DOMContentLoaded', function() {
    checkLoginStatus();
    initializeNavigation();
    setupFormEvents();
});

// 检查登录状态
function checkLoginStatus() {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('user_id');
    const username = localStorage.getItem('username');
    
    if (!token || !userId) {
        // 未登录，重定向到登录页面
        window.location.href = 'login.html';
        return;
    }
    
    // 已登录，保存用户ID
    currentUserID = userId;
    
    // 加载用户收藏
    loadUserFavorites();
}

// 初始化导航交互
function initializeNavigation() {
    // 监听滚动事件，更新导航活跃状态
    window.addEventListener('scroll', updateActiveNav);
    
    // 添加导航链接点击事件
    document.querySelectorAll('.nav-item, .vertical-nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            document.querySelector(targetId).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
}

// 设置表单事件处理
function setupFormEvents() {
    // 可视化分析数据源选择事件
    document.getElementById('viz-data-source').addEventListener('change', function() {
        const customInputRow = document.getElementById('viz-custom-input-row');
        if (this.value === 'custom') {
            customInputRow.style.display = 'flex';
        } else {
            customInputRow.style.display = 'none';
        }
    });
    
    // 分析报告数据源选择事件
    document.getElementById('report-data-source').addEventListener('change', function() {
        const customInputRow = document.getElementById('report-custom-input-row');
        if (this.value === 'custom') {
            customInputRow.style.display = 'flex';
        } else {
            customInputRow.style.display = 'none';
        }
    });
}

// 更新导航活跃状态
function updateActiveNav() {
    const sections = document.querySelectorAll('.section');
    const navItems = document.querySelectorAll('.nav-item');
    const verticalNavLinks = document.querySelectorAll('.vertical-nav-link');
    
    let currentSectionId = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.pageYOffset >= sectionTop - 100 && 
            window.pageYOffset < sectionTop + sectionHeight - 100) {
            currentSectionId = section.id;
        }
    });
    
    // 更新顶部导航
    navItems.forEach(item => {
        if (item.getAttribute('href') === '#' + currentSectionId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // 更新侧边导航
    verticalNavLinks.forEach(link => {
        if (link.getAttribute('href') === '#' + currentSectionId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
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
    
    // 添加时间戳避免缓存问题
    const timestamp = new Date().getTime();
    return `http://localhost:5001/api/photos/${selectedNumber}.png?t=${timestamp}`;
}

// 处理封面图片加载
function handleCoverImages() {
    // 查找所有封面图片
    const coverImages = document.querySelectorAll('.anime-cover');
    
    // 为每个图片添加错误处理
    coverImages.forEach(img => {
        // 当图片加载失败时
        img.onerror = async function() {
            console.error(`图片加载失败: ${this.src}`);
            this.onerror = null; // 防止无限循环
            
            try {
                // 尝试使用随机图片
                const randomNum = Math.floor(Math.random() * 75) + 1;
                this.src = `D:/PythonProject1/photos/${randomNum}.png`;
            } catch (error) {
                console.error('获取随机封面失败:', error);
                
                // 如果随机图片也失败，使用内嵌SVG
                this.onerror = function() {
                    this.onerror = null;
                    const loadingSpinner = this.previousElementSibling;
                    if (loadingSpinner && loadingSpinner.classList.contains('loading-spinner')) {
                        loadingSpinner.style.display = 'none';
                    }
                    this.style.display = 'block';
                    this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjI2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTgwIiBoZWlnaHQ9IjI2MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjkwIiB5PSIxMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzg4ODg4OCI+5peg5rOV5Yqg6L295Zu+54mHPC90ZXh0Pjwvc3ZnPg==';
                };
            }
        };
    });
}

// 修改渲染收藏列表函数，添加分页功能
function renderFavorites(page = 1) {
    const container = document.getElementById('favorites-container');
    const paginationContainer = document.getElementById('favorites-pagination') || createPaginationContainer();
    
    // 确保页面清空
    container.innerHTML = '';
    
    // 检查是否有收藏数据
    if (!userFavorites || userFavorites.length === 0) {
        container.innerHTML = '<div class="error-message">暂无收藏，快去收藏你喜欢的动漫吧！</div>';
        paginationContainer.style.display = 'none';
        return;
    }
    
    // 计算总页数
    totalPages = Math.ceil(userFavorites.length / itemsPerPage);
    
    // 确保当前页有效
    currentPage = page;
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    // 获取当前页的数据
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageData = userFavorites.slice(startIndex, endIndex);
    
    // 渲染当前页的数据
    currentPageData.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        
        // 格式化类型标签
        let genresHTML = '';
        if (anime.genres) {
            const genres = typeof anime.genres === 'string' ? anime.genres.split(',') : anime.genres;
            genresHTML = Array.isArray(genres) ? genres.slice(0, 3).join(', ') : anime.genres;
        }
        
        // 格式化工作室标签
        let studiosHTML = '';
        if (anime.studios) {
            const studios = typeof anime.studios === 'string' ? anime.studios.split(',') : anime.studios;
            studiosHTML = Array.isArray(studios) ? studios.slice(0, 1).join(', ') : anime.studios;
        }
        
        // 准备封面图片路径 - 优先使用随机API
        let coverSrc = '';
        
        // 创建卡片HTML
        card.innerHTML = `
            <div class="anime-cover-container">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                </div>
                <img src="${getUniqueCover()}" alt="${anime.title}" class="anime-cover" style="display:none;">
            </div>
            <div class="anime-info">
                <div class="anime-title" data-full-title="${anime.title}">${anime.title}</div>
                <div class="anime-detail"><strong>评分:</strong> ${anime.score || '无'}</div>
                ${genresHTML ? `<div class="anime-detail"><strong>类型:</strong> ${genresHTML}</div>` : ''}
                ${studiosHTML ? `<div class="anime-detail"><strong>制作方:</strong> ${studiosHTML}</div>` : ''}
            </div>
            <div class="anime-actions">
                <button class="remove-favorite-btn" onclick="removeFromFavorites(${anime.id})">删除收藏</button>
            </div>
        `;
        
        // 设置按钮样式
        const style = document.createElement('style');
        style.textContent = `
            .remove-favorite-btn {
                background-color: #e74c3c;
                color: white;
                border: none;
                padding: 8px 15px;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s;
                width: 120px;
                height: 40px;
            }
            .remove-favorite-btn:hover {
                background-color: #c0392b;
            }
            .loading-spinner {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                background-color: rgba(255, 255, 255, 0.7);
            }
            .spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        // 创建一个用于存储已使用图片的全局数组
        if (!window.usedCoverIndexes) {
            window.usedCoverIndexes = new Set();
        }

        // 选择一个未使用的随机图片索引
        let photoIndex;
        do {
            photoIndex = Math.floor(Math.random() * 75) + 1;
        } while (window.usedCoverIndexes.has(photoIndex) && window.usedCoverIndexes.size < 75);

        // 如果所有图片都被使用过，则重置
        if (window.usedCoverIndexes.size >= 75) {
            window.usedCoverIndexes.clear();
        }

        // 将选中的索引添加到已使用集合
        window.usedCoverIndexes.add(photoIndex);

        // 设置封面图片（使用随机图片）
        const coverImg = card.querySelector('.anime-cover');
        coverImg.onload = function() {
            // 图片加载成功时，隐藏加载动画并显示图片
            const loadingSpinner = this.previousElementSibling;
            loadingSpinner.style.display = 'none';
            this.style.display = 'block';
        };
        
        coverImg.onerror = function() {
            // 加载失败时尝试使用备用图片
            this.onerror = null;
            const newIndex = Math.floor(Math.random() * 75) + 1;
            this.src = `http://localhost:5001/photos/${newIndex}.png`;
            
            // 如果备用图片也失败，使用内嵌SVG
            this.onerror = function() {
                this.onerror = null;
                const loadingSpinner = this.previousElementSibling;
                loadingSpinner.style.display = 'none';
                this.style.display = 'block';
                this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjI2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTgwIiBoZWlnaHQ9IjI2MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjkwIiB5PSIxMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzg4ODg4OCI+5peg5rOV5Yqg6L295Zu+54mHPC90ZXh0Pjwvc3ZnPg==';
            };
        };
        
        container.appendChild(card);
    });
    
    // 异步加载所有卡片的封面图片
    loadCardCovers();
    
    // 更新分页控件
    updatePagination();
    
    // 显示分页区域
    paginationContainer.style.display = totalPages > 1 ? 'flex' : 'none';
}

// 创建分页容器
function createPaginationContainer() {
    const favoritesSection = document.getElementById('favorites-section');
    
    const paginationContainer = document.createElement('div');
    paginationContainer.id = 'favorites-pagination';
    paginationContainer.className = 'pagination-container';
    paginationContainer.innerHTML = `
        <button id="prev-page" class="pagination-button">上一页</button>
        <div id="page-info" class="page-info">第 1 页 / 共 1 页</div>
        <button id="next-page" class="pagination-button">下一页</button>
    `;
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .pagination-container {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-top: 20px;
            gap: 15px;
        }
        
        .pagination-button {
            background-color: #3498db;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
            width: 120px;
            height: 40px;
        }
        
        .pagination-button:hover {
            background-color: #2980b9;
        }
        
        .pagination-button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        
        .page-info {
            font-size: 16px;
            font-weight: bold;
        }
        
        .anime-cover-loading {
            width: 100%;
            height: 100%;
        }
        
        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .anime-cover.loaded {
            animation: fade-in 0.3s ease-in-out;
        }
    `;
    document.head.appendChild(style);
    
    // 添加到页面
    favoritesSection.appendChild(paginationContainer);
    
    // 添加事件监听器
    document.getElementById('prev-page').addEventListener('click', goToPreviousPage);
    document.getElementById('next-page').addEventListener('click', goToNextPage);
    
    return paginationContainer;
}

// 异步加载卡片封面
async function loadCardCovers() {
    const coverImages = document.querySelectorAll('.anime-cover');
    
    // 为每个封面图片设置加载
    coverImages.forEach(async (img, index) => {
        try {
            // 为每张图片选择一个随机封面
            const randomNum = Math.floor(Math.random() * 75) + 1;
            img.src = `http://localhost:5001/photos/${randomNum}.png`;
            
            // 设置图片加载成功的处理
            img.onload = function() {
                // 隐藏加载指示器
                const loadingSpinner = this.previousElementSibling;
                if (loadingSpinner && loadingSpinner.classList.contains('loading-spinner')) {
                    loadingSpinner.style.display = 'none';
                }
                // 显示图片
                this.style.display = 'block';
                this.classList.add('loaded');
            };
            
            // 设置图片加载失败的处理
            img.onerror = function() {
                console.error(`图片加载失败: ${this.src}`);
                this.onerror = null; // 防止无限循环
                
                // 尝试另一个随机图片
                const newRandomNum = Math.floor(Math.random() * 75) + 1;
                this.src = `http://localhost:5001/photos/${newRandomNum}.png`;
                
                // 如果随机图片也失败，使用内嵌SVG
                this.onerror = function() {
                    this.onerror = null;
                    const loadingSpinner = this.previousElementSibling;
                    if (loadingSpinner && loadingSpinner.classList.contains('loading-spinner')) {
                        loadingSpinner.style.display = 'none';
                    }
                    this.style.display = 'block';
                    this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjI2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTgwIiBoZWlnaHQ9IjI2MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjkwIiB5PSIxMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzg4ODg4OCI+5peg5rOV5Yqg6L295Zu+54mHPC90ZXh0Pjwvc3ZnPg==';
                };
            };
        } catch (error) {
            console.error('加载封面失败:', error);
            // 出错时使用随机图片
            const randomNum = Math.floor(Math.random() * 75) + 1;
            img.src = `http://localhost:5001/photos/${randomNum}.png`;
        }
    });
}

// 更新分页控件
function updatePagination() {
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    // 更新页码信息
    pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
    
    // 更新按钮状态
    prevButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
}

// 转到上一页
function goToPreviousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderFavorites(currentPage);
        
        // 滚动到收藏区域顶部
        document.getElementById('favorites-section').scrollIntoView({behavior: 'smooth'});
    }
}

// 转到下一页
function goToNextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        renderFavorites(currentPage);
        
        // 滚动到收藏区域顶部
        document.getElementById('favorites-section').scrollIntoView({behavior: 'smooth'});
    }
}

// 回到顶部
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// 加载用户收藏
function loadUserFavorites() {
    if (!currentUserID) {
        document.getElementById('favorites-container').innerHTML = 
            '<div class="error-message">请先登录</div>';
        return;
    }
    
    // 显示加载状态
    document.getElementById('favorites-container').innerHTML = 
        '<div class="loading-message">正在加载您的收藏...</div>';
    
    // 尝试从API获取收藏数据
    fetch(`${API_BASE_URL}/api/user_favorites?user_id=${currentUserID}`)
        .then(response => {
            // 检查响应状态
            if (!response.ok) {
                throw new Error(`服务器返回错误: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // 确保数据是数组类型
            if (Array.isArray(data)) {
                userFavorites = data;
            } else if (data && typeof data === 'object') {
                // 如果是对象，检查是否有数组属性
                if (Array.isArray(data.favorites)) {
                    userFavorites = data.favorites;
                } else {
                    // 如果没有数组属性，使用模拟数据
                    console.warn('API返回的数据格式不正确，使用模拟数据');
                    userFavorites = getDefaultAnimeData();
                }
            } else {
                // 使用模拟数据
                console.warn('API返回的数据格式不正确，使用模拟数据');
                userFavorites = getDefaultAnimeData();
            }
            
            // 渲染第一页收藏
            currentPage = 1;
            renderFavorites(currentPage);
        })
        .catch(error => {
            console.error('获取收藏失败:', error);
            // 使用模拟数据
            userFavorites = getDefaultAnimeData();
            
            // 渲染第一页收藏
            currentPage = 1;
            renderFavorites(currentPage);
            
            // 显示错误消息
            document.getElementById('favorites-container').insertAdjacentHTML('afterbegin', 
                `<div class="error-message">加载收藏失败: ${error.message}，已显示模拟数据</div>`);
        });
}

// 获取默认动漫数据（当API请求失败时使用）
function getDefaultAnimeData() {
    // 返回20条模拟数据
    return [
        {id: 1, title: "进击的巨人", score: 9.1, type: "TV", episodes: 25, members: 1500000, rank: 15, genres: "Action,Drama,Fantasy", studios: "Wit Studio"},
        {id: 2, title: "鬼灭之刃", score: 8.9, type: "TV", episodes: 26, members: 1200000, rank: 25, genres: "Action,Demons,Historical", studios: "ufotable"},
        {id: 3, title: "命运石之门", score: 9.2, type: "TV", episodes: 24, members: 950000, rank: 5, genres: "Sci-Fi,Thriller", studios: "White Fox"},
        {id: 4, title: "你的名字", score: 9.3, type: "Movie", episodes: 1, members: 2000000, rank: 3, genres: "Romance,Supernatural,Drama", studios: "CoMix Wave Films"},
        {id: 5, title: "灵能百分百", score: 8.7, type: "TV", episodes: 13, members: 800000, rank: 45, genres: "Action,Comedy,Supernatural", studios: "Bones"},
        {id: 6, title: "一拳超人", score: 8.8, type: "TV", episodes: 12, members: 1450000, rank: 32, genres: "Action,Comedy,Parody", studios: "Madhouse"},
        {id: 7, title: "海贼王", score: 8.5, type: "TV", episodes: 1000, members: 1750000, rank: 27, genres: "Action,Adventure,Fantasy", studios: "Toei Animation"},
        {id: 8, title: "全职猎人", score: 9.1, type: "TV", episodes: 148, members: 1100000, rank: 11, genres: "Action,Adventure,Fantasy", studios: "Madhouse"},
        {id: 9, title: "银魂", score: 8.7, type: "TV", episodes: 367, members: 950000, rank: 38, genres: "Action,Comedy,Historical", studios: "Sunrise"},
        {id: 10, title: "刀剑神域", score: 7.5, type: "TV", episodes: 25, members: 1650000, rank: 120, genres: "Action,Adventure,Fantasy", studios: "A-1 Pictures"},
        {id: 11, title: "我的英雄学院", score: 8.4, type: "TV", episodes: 88, members: 1320000, rank: 56, genres: "Action,Comedy,Super Power", studios: "Bones"},
        {id: 12, title: "钢之炼金术师", score: 9.0, type: "TV", episodes: 64, members: 1050000, rank: 14, genres: "Action,Adventure,Drama", studios: "Bones"},
        {id: 13, title: "fate/zero", score: 8.5, type: "TV", episodes: 13, members: 890000, rank: 52, genres: "Action,Fantasy,Supernatural", studios: "ufotable"},
        {id: 14, title: "Re:从零开始的异世界生活", score: 8.1, type: "TV", episodes: 25, members: 980000, rank: 87, genres: "Drama,Fantasy,Thriller", studios: "White Fox"},
        {id: 15, title: "overlord", score: 8.0, type: "TV", episodes: 13, members: 850000, rank: 95, genres: "Action,Adventure,Fantasy", studios: "Madhouse"},
        {id: 16, title: "浪客剑心", score: 8.5, type: "TV", episodes: 94, members: 650000, rank: 58, genres: "Action,Comedy,Historical", studios: "Studio Deen"},
        {id: 17, title: "东京食尸鬼", score: 7.8, type: "TV", episodes: 12, members: 1120000, rank: 112, genres: "Action,Horror,Supernatural", studios: "Pierrot"},
        {id: 18, title: "青春猪头少年不会梦到兔女郎学姐", score: 8.3, type: "TV", episodes: 13, members: 780000, rank: 76, genres: "Drama,Romance,Supernatural", studios: "CloverWorks"},
        {id: 19, title: "日常", score: 8.5, type: "TV", episodes: 26, members: 520000, rank: 62, genres: "Comedy,School,Slice of Life", studios: "Kyoto Animation"},
        {id: 20, title: "Angel Beats!", score: 8.3, type: "TV", episodes: 13, members: 970000, rank: 73, genres: "Drama,Supernatural", studios: "P.A. Works"}
    ];
}

// 从收藏中移除
function removeFromFavorites(animeId) {
    if (!currentUserID) {
        alert('请先登录');
        return;
    }
    
    if (!confirm('确定要移除这部动漫吗？')) {
        return;
    }
    
    fetch(`${API_BASE_URL}/api/favorite`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: currentUserID,
            anime_id: animeId,
            action: 'remove'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert(data.message);
            
            // 更新本地数据
            userFavorites = userFavorites.filter(anime => anime.id !== animeId);
            
            // 如果当前页已经没有数据并且不是第一页，后退一页
            const startIndex = (currentPage - 1) * itemsPerPage;
            if (startIndex >= userFavorites.length && currentPage > 1) {
                currentPage--;
            }
            
            // 重新渲染当前页
            renderFavorites(currentPage);
        } else {
            throw new Error(data.error || '操作失败');
        }
    })
    .catch(error => {
        console.error('取消收藏失败:', error);
        alert('操作失败，请稍后再试');
    });
}

// 生成可视化图表
function generateVisualization() {
    const source = document.getElementById('viz-data-source').value;
    let titles = [];
    
    if (source === 'favorites') {
        // 使用收藏的动漫
        if (!userFavorites || userFavorites.length === 0) {
            alert('您还没有收藏任何动漫，请先添加收藏');
            return;
        }
        // 确保userFavorites是数组
        if (Array.isArray(userFavorites)) {
            titles = userFavorites.map(anime => anime.title);
        } else {
            alert('数据格式错误，请刷新页面重试');
            return;
        }
    } else {
        // 使用自定义输入
        const customTitles = document.getElementById('viz-anime-titles').value.trim();
        if (!customTitles) {
            alert('请输入至少一个动漫名称');
            return;
        }
        titles = customTitles.split(',').map(title => title.trim());
    }
    
    // 限制最多处理20个标题
    if (titles.length > 20) {
        alert('最多只能处理20个动漫标题，已自动截取前20个');
        titles = titles.slice(0, 20);
    } else if (titles.length < 1) {
        alert('请至少输入一个动漫名称');
        return;
    }
    
    const chartContainer = document.getElementById('chart-container');
    chartContainer.innerHTML = '<div class="loading-message">正在生成图表，请稍候...</div>';
    chartContainer.style.display = 'block';
    
    // 向后端发送请求生成图表
    fetch(`${API_BASE_URL}/api/visualize`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            titles: titles
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`服务器响应错误: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // 清空loading消息
        chartContainer.innerHTML = '';
        
        // 创建图表轮播结构
        createChartSlides(chartContainer, data.charts || getDefaultChartData());
        
        // 重置轮播索引并显示第一张图
        currentChartIndex = 0;
        updateChartSlides();
        
        // 显示容器
        chartContainer.style.display = 'block';
    })
    .catch(error => {
        console.error('获取可视化图表失败:', error);
        
        // 出错时使用默认图表
        chartContainer.innerHTML = '';
        createChartSlides(chartContainer, getDefaultChartData());
        currentChartIndex = 0;
        updateChartSlides();
        chartContainer.style.display = 'block';
        
        // 显示错误消息
        chartContainer.insertAdjacentHTML('afterbegin', 
            `<div class="error-message">生成图表失败: ${error.message}，已显示样例图表</div>`);
    });
}

// 获取默认图表数据（当API请求失败时使用）
function getDefaultChartData() {
    return [
        {
            id: 'pie-chart',
            title: '动漫类型分布饼状图',
            description: '展示不同标签在所选动漫中的分布比例',
            imageUrl: 'http://localhost:5001/photos/1.png',
            type: 'pie'
        },
        {
            id: 'line-chart',
            title: '集数与用户数关系折线图',
            description: '分析不同动漫的集数与用户数的关系',
            imageUrl: 'http://localhost:5001/photos/2.png',
            type: 'line'
        },
        {
            id: 'bar-chart',
            title: '评分分布柱状图',
            description: '展示动漫评分的分布情况',
            imageUrl: 'http://localhost:5001/photos/3.png',
            type: 'bar'
        },
        {
            id: 'bubble-chart',
            title: '观众-集数-评分气泡图',
            description: '通过气泡大小表示集数，分析观众数量与评分的关系',
            imageUrl: 'http://localhost:5001/photos/4.png',
            type: 'bubble'
        }
    ];
}

// 创建图表幻灯片结构
function createChartSlides(container, chartData) {
    // 添加幻灯片
    chartData.forEach((chart, index) => {
        const slideDiv = document.createElement('div');
        slideDiv.id = chart.id || `chart-slide-${index+1}`;
        slideDiv.className = 'chart-slide' + (index === 0 ? ' active' : '');
        
        // 添加标题、图片和描述
        slideDiv.innerHTML = `
            <h3>${chart.title}</h3>
            <p class="chart-description">${chart.description || ''}</p>
            <img class="chart-image" src="${chart.imageUrl}" alt="${chart.title}" title="${chart.title}">
            <p class="chart-note">注：此图表基于您选择的动漫数据动态生成</p>
        `;
        
        container.appendChild(slideDiv);
    });
    
    // 添加导航按钮
    const navButtons = document.createElement('div');
    navButtons.className = 'chart-nav-buttons';
    navButtons.innerHTML = `
        <button class="form-button" onclick="showPreviousChart()">上一张</button>
        <span class="chart-counter" id="chart-counter">1 / ${chartData.length}</span>
        <button class="form-button" onclick="showNextChart()">下一张</button>
    `;
    
    container.appendChild(navButtons);
}

// 更新图表轮播状态
function updateChartSlides() {
    const slides = document.querySelectorAll('.chart-slide');
    
    if (!slides || slides.length === 0) {
        console.error('No chart slides found');
        return;
    }
    
    // 隐藏所有幻灯片
    slides.forEach(slide => {
        slide.classList.remove('active');
    });
    
    // 确保索引在有效范围内
    if (currentChartIndex >= slides.length) {
        currentChartIndex = 0;
    }
    
    // 显示当前幻灯片
    slides[currentChartIndex].classList.add('active');
    
    // 更新计数器
    updateChartCounter(currentChartIndex + 1, slides.length);
}

// 生成分析报告
function generateReport() {
    const source = document.getElementById('report-data-source').value;
    let titles = [];
    
    if (source === 'favorites') {
        // 使用收藏的动漫
        if (!userFavorites || userFavorites.length === 0) {
            alert('您还没有收藏任何动漫，请先添加收藏');
            return;
        }
        // 确保userFavorites是数组
        if (Array.isArray(userFavorites)) {
            titles = userFavorites.map(anime => anime.title);
        } else {
            alert('数据格式错误，请刷新页面重试');
            return;
        }
    } else {
        // 使用自定义输入
        const customTitles = document.getElementById('report-anime-titles').value.trim();
        if (!customTitles) {
            alert('请输入至少一个动漫名称');
            return;
        }
        titles = customTitles.split(',').map(title => title.trim());
    }
    
    // 限制最多处理20个标题
    titles = titles.slice(0, 20);
    
    const reportContainer = document.getElementById('report-container');
    reportContainer.innerHTML = '<div class="loading-message">正在生成报告，请稍候...</div>';
    reportContainer.style.display = 'block';
    
    // 确保下载按钮隐藏，直到报告生成完成
    document.getElementById('download-report-container').style.display = 'none';
    
    // 在实际应用中，这里应该调用后端API来获取完整分析报告
    // 现在使用模拟数据
    setTimeout(() => {
        // 获取相关动漫数据
        let reportHTML = '<h3>分析报告</h3>';
        reportHTML += '<h4>动漫基本信息</h4>';
        reportHTML += '<table border="1" style="width:100%; border-collapse:collapse; margin-bottom:20px;">';
        reportHTML += '<tr><th>ID</th><th>标题</th><th>评分</th><th>类型</th><th>集数</th><th>人气</th><th>排名</th></tr>';
        
        // 使用收藏数据或模拟数据
        const animeData = userFavorites.length > 0 && Array.isArray(userFavorites) ? userFavorites : [
            {id: 1, title: "进击的巨人", score: 9.1, type: "TV", episodes: 25, members: 1500000, rank: 15, genres: "Action,Drama,Fantasy", studios: "Wit Studio"},
            {id: 2, title: "鬼灭之刃", score: 8.9, type: "TV", episodes: 26, members: 1200000, rank: 25, genres: "Action,Demons,Historical", studios: "ufotable"},
            {id: 3, title: "命运石之门", score: 9.2, type: "TV", episodes: 24, members: 950000, rank: 5, genres: "Sci-Fi,Thriller", studios: "White Fox"}
        ];
        
        // 添加动漫信息到表格
        animeData.forEach(anime => {
            reportHTML += `<tr>
                <td>${anime.id || '-'}</td>
                <td>${anime.title || '-'}</td>
                <td>${anime.score || '-'}</td>
                <td>${anime.type || '-'}</td>
                <td>${anime.episodes || '-'}</td>
                <td>${anime.members ? anime.members.toLocaleString() : '-'}</td>
                <td>${anime.rank || '-'}</td>
            </tr>`;
        });
        
        reportHTML += '</table>';
        
        // 添加分析结果
        reportHTML += '<h4>统计分析</h4>';
        
        // 添加评分分析
        const scores = animeData.map(a => Number(a.score)).filter(s => !isNaN(s) && s > 0);
        const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 'N/A';
        const maxScore = scores.length ? Math.max(...scores).toFixed(2) : 'N/A';
        const minScore = scores.length ? Math.min(...scores).toFixed(2) : 'N/A';
        
        reportHTML += `<p><strong>评分分析：</strong>平均分 ${avgScore}，最高分 ${maxScore}，最低分 ${minScore}</p>`;
        
        // 添加类型分析
        let allGenres = [];
        animeData.forEach(anime => {
            if (anime.genres) {
                const genres = typeof anime.genres === 'string' ? anime.genres.split(',') : 
                               Array.isArray(anime.genres) ? anime.genres : [anime.genres];
                allGenres = allGenres.concat(genres);
            }
        });
        
        // 统计类型频率
        const genreCounts = {};
        allGenres.forEach(genre => {
            if (genre && typeof genre === 'string') {
                genre = genre.trim();
                genreCounts[genre] = (genreCounts[genre] || 0) + 1;
            }
        });
        
        // 获取前3个最常见类型
        const topGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([genre, count]) => `${genre} (${count}部)`);
        
        reportHTML += `<p><strong>类型分析：</strong>共有 ${allGenres.length} 个类型标签，最常见类型: ${topGenres.join(', ') || '未知'}</p>`;
        
        // 添加集数与人气分析
        const hasEpisodes = animeData.filter(a => a.episodes).length > 0;
        const hasMembers = animeData.filter(a => a.members).length > 0;
        
        if (hasEpisodes && hasMembers) {
            // 分析集数与人气的关系
            reportHTML += '<p><strong>集数与人气分析：</strong></p>';
            
            // 简单相关性分析
            const episodesArr = animeData.map(a => Number(a.episodes)).filter(e => !isNaN(e) && e > 0);
            const membersArr = animeData.map(a => Number(a.members)).filter(m => !isNaN(m) && m > 0);
            
            if (episodesArr.length > 1 && membersArr.length > 1) {
                // 简单相关性判断
                const avgEpisodes = episodesArr.reduce((a, b) => a + b, 0) / episodesArr.length;
                const avgMembers = membersArr.reduce((a, b) => a + b, 0) / membersArr.length;
                
                reportHTML += `<p>平均集数: ${avgEpisodes.toFixed(1)}，平均观众: ${avgMembers.toLocaleString()}</p>`;
                
                // 找出最受欢迎的动漫
                const mostPopular = animeData.reduce((prev, current) => 
                    (prev.members > current.members) ? prev : current
                );
                
                reportHTML += `<p>最受欢迎的动漫是 ${mostPopular.title}，拥有 ${mostPopular.members ? mostPopular.members.toLocaleString() : '未知'} 名观众</p>`;
            }
        }
        
        // 添加综合分析
        reportHTML += '<h4>综合分析</h4>';
        reportHTML += '<p>根据分析结果，这些动漫在评分上表现良好，平均分高于系统平均水平（6.24分）。';
        reportHTML += '从类型分布看，主要集中在动作、奇幻等领域，这与全球动漫流行趋势一致。';
        reportHTML += '集数与人气关系显示，优质内容（高评分）比内容长度更能吸引观众。</p>';
        
        // 添加建议
        reportHTML += '<h4>建议</h4>';
        reportHTML += '<p>1. 建议关注评分在8.5以上的作品，这类作品普遍质量较高</p>';
        reportHTML += '<p>2. 可以尝试多元化选择不同类型，拓展观影体验</p>';
        reportHTML += '<p>3. 短篇高质量作品往往是入门的好选择</p>';
        
        // 保存当前报告数据用于下载
        currentReportData = {
            title: '动漫分析报告',
            date: new Date().toLocaleDateString(),
            content: reportHTML,
            animeData: animeData
        };
        
        // 显示报告内容
        reportContainer.innerHTML = reportHTML;
        
        // 显示下载按钮
        document.getElementById('download-report-container').style.display = 'block';
    }, 2000);
}

// 下载报告为Word文档
function downloadReport() {
    if (!currentReportData) {
        alert('请先生成报告');
        return;
    }
    
    // 在实际应用中，可以调用后端API来生成Word文档
    // 这里使用前端方法直接生成一个简单的HTML并下载
    
    const reportHTML = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:w="urn:schemas-microsoft-com:office:word" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta charset="utf-8">
        <title>动漫分析报告</title>
        <style>
            body { font-family: 'Microsoft YaHei', Arial, sans-serif; }
            table { border-collapse: collapse; width: 100%; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1, h2, h3, h4 { color: #333; }
        </style>
    </head>
    <body>
        <h1>动漫分析报告</h1>
        <p>生成日期: ${currentReportData.date}</p>
        ${currentReportData.content}
    </body>
    </html>
    `;
    
    // 创建Blob
    const blob = new Blob([reportHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    
    // 创建下载链接
    const a = document.createElement('a');
    a.href = url;
    a.download = `动漫分析报告_${new Date().toISOString().slice(0, 10)}.doc`;
    
    // 触发下载
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // 清理URL对象
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

// 退出登录
function logout() {
    localStorage.removeItem('user_id');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    
    // 跳转到登录页面
    window.location.href = 'login.html';
}

// 显示下一张图表
function showNextChart() {
    const slides = document.querySelectorAll('.chart-slide');
    
    if (!slides || slides.length === 0) {
        console.error('No chart slides found');
        return;
    }
    
    // 隐藏当前幻灯片
    slides[currentChartIndex].classList.remove('active');
    
    // 更新索引
    currentChartIndex = (currentChartIndex + 1) % slides.length;
    
    // 显示新的幻灯片
    slides[currentChartIndex].classList.add('active');
    
    // 更新计数器
    updateChartCounter(currentChartIndex + 1, slides.length);
}

// 显示上一张图表
function showPreviousChart() {
    const slides = document.querySelectorAll('.chart-slide');
    
    if (!slides || slides.length === 0) {
        console.error('No chart slides found');
        return;
    }
    
    // 隐藏当前幻灯片
    slides[currentChartIndex].classList.remove('active');
    
    // 更新索引
    currentChartIndex = (currentChartIndex - 1 + slides.length) % slides.length;
    
    // 显示新的幻灯片
    slides[currentChartIndex].classList.add('active');
    
    // 更新计数器
    updateChartCounter(currentChartIndex + 1, slides.length);
}

// 更新图表计数器
function updateChartCounter(current, total) {
    const counter = document.getElementById('chart-counter');
    if (counter) {
        counter.textContent = `${current} / ${total}`;
    }
} 