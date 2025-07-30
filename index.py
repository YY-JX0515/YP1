from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import mysql.connector
import random
import os
import math
from collections import Counter
import uuid
import matplotlib
matplotlib.use('Agg')  # 设置后端，避免GUI需求
import matplotlib.pyplot as plt
import numpy as np
import io
import base64
import matplotlib.font_manager as fm
from matplotlib.ticker import MaxNLocator
import matplotlib.cm as cm
import glob
from datetime import datetime
import textwrap

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})  # 允许所有来源访问API

# 数据库连接配置
db_config = {
    "host": "localhost",
    "user": "root",
    "password": "123456",
    "database": "myanime"
}

# 封面图片目录
COVER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'photos')  # 使用相对路径

# HTML文件目录
HTML_DIR = os.path.dirname(os.path.abspath(__file__))

# 设置静态文件目录
app.static_folder = os.path.join(HTML_DIR, 'static')

# 设置中文字体支持
try:
    # 尝试使用微软雅黑字体（在Windows系统上）
    plt.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei', 'Arial Unicode MS']
    plt.rcParams['axes.unicode_minus'] = False  # 正确显示负号
except:
    print("中文字体设置失败，将使用默认字体")

# 全局变量，用于跟踪已使用的封面
used_covers = set()

# 初始化数据库表
def init_database():
    conn = get_db_connection()
    if not conn:
        print("警告：无法连接到数据库，应用可能无法正常工作")
        return
    
    cursor = conn.cursor()
    
    try:
        # 检查用户表是否存在
        cursor.execute("SHOW TABLES LIKE 'user'")
        if not cursor.fetchone():
            # 创建用户表
            print("创建用户表...")
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS user (
                user_id VARCHAR(36) PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            
            # 创建测试用户
            test_user_id = str(uuid.uuid4())
            cursor.execute(
                "INSERT INTO user (user_id, username, password) VALUES (%s, %s, %s)",
                (test_user_id, "test", "test123")
            )
            print(f"创建测试用户成功! 用户ID: {test_user_id}")
        
        # 检查用户收藏表是否存在
        cursor.execute("SHOW TABLES LIKE 'user_favorites'")
        if not cursor.fetchone():
            # 创建收藏表
            print("创建用户收藏表...")
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_favorites (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                anime_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_favorite (user_id, anime_id)
            )
            """)
        
        # 检查用户搜索点击表是否存在
        cursor.execute("SHOW TABLES LIKE 'user_search_clicks'")
        if not cursor.fetchone():
            print("创建用户搜索点击表...")
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_search_clicks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                search_term VARCHAR(255) NOT NULL,
                anime_id INT NOT NULL,
                clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_search_term (search_term),
                INDEX idx_anime_id (anime_id)
            )
            """)
        
        # 检查搜索词衰减表是否存在
        cursor.execute("SHOW TABLES LIKE 'search_term_decay'")
        if not cursor.fetchone():
            print("创建搜索词衰减表...")
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS search_term_decay (
                user_id VARCHAR(36) NOT NULL,
                search_term VARCHAR(255) NOT NULL,
                last_searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                search_count INT DEFAULT 1,
                decay_factor FLOAT DEFAULT 1.0,
                PRIMARY KEY (user_id, search_term),
                INDEX idx_user_id (user_id),
                INDEX idx_last_searched (last_searched_at)
            )
            """)
        
        # 检查动漫搜索相关性表是否存在
        cursor.execute("SHOW TABLES LIKE 'anime_search_relevance'")
        if not cursor.fetchone():
            print("创建动漫搜索相关性表...")
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS anime_search_relevance (
                anime_id INT NOT NULL,
                search_term VARCHAR(255) NOT NULL,
                click_weight FLOAT DEFAULT 0.0,
                search_weight FLOAT DEFAULT 0.0,
                total_relevance FLOAT DEFAULT 0.0,
                PRIMARY KEY (anime_id, search_term),
                INDEX idx_anime_id (anime_id),
                INDEX idx_search_term (search_term),
                INDEX idx_relevance (total_relevance)
            )
            """)
        
        # 提交所有更改
        conn.commit()
        print("数据库初始化成功!")
    
    except mysql.connector.Error as err:
        print(f"数据库初始化失败: {err}")
        conn.rollback()
    
    finally:
        cursor.close()
        conn.close()

# 根路由 - 提供首页
@app.route('/')
def index():
    return send_from_directory(HTML_DIR, 'index.html')

# 提供静态HTML文件
@app.route('/<path:filename>')
def serve_html(filename):
    if filename.endswith('.html'):
        return send_from_directory(HTML_DIR, filename)
    return "", 404

# 提供JavaScript文件
@app.route('/<path:filename>.js')
def serve_js(filename):
    return send_from_directory(HTML_DIR, f"{filename}.js")

# 提供图片访问
@app.route('/photos/<filename>')
def serve_photo_direct(filename):
    return serve_photo(filename)

@app.route('/api/photos/<filename>')
def serve_photo(filename):
    try:
        # 如果是数据分析版块的图片请求
        if filename == 'default-cover.png':
            default_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'default-cover.png')
            if os.path.exists(default_path):
                return send_file(default_path)
            return "Default cover not found", 404
        
        # 动漫卡片封面图片请求
        global used_covers
        photo_path = os.path.join(COVER_DIR, filename)
        
        # 如果请求的图片不存在，随机选择一张未使用的图片
        if not os.path.exists(photo_path):
            available_photos = [f for f in os.listdir(COVER_DIR) 
                              if f.endswith(('.png', '.jpg', '.jpeg')) 
                              and f not in used_covers]
            
            # 如果所有图片都已使用过，重置使用记录
            if not available_photos:
                used_covers.clear()
                available_photos = [f for f in os.listdir(COVER_DIR) 
                                  if f.endswith(('.png', '.jpg', '.jpeg'))]
            
            if available_photos:
                random_photo = random.choice(available_photos)
                used_covers.add(random_photo)
                return send_file(os.path.join(COVER_DIR, random_photo))
            
            return "No images available", 404
        
        # 如果请求的图片存在，添加到已使用集合
        used_covers.add(filename)
        return send_file(photo_path)
        
    except Exception as e:
        print(f"加载图片失败: {e}")
        return "Error loading image", 500

# 重置已使用封面的函数
@app.route('/api/reset_covers', methods=['POST'])
def reset_covers():
    global used_covers
    used_covers.clear()
    return jsonify({"message": "Cover usage reset successfully"})

# 提供视频访问
@app.route('/static/videos/<filename>')
def serve_video(filename):
    try:
        return send_from_directory(os.path.join(app.static_folder, 'videos'), filename)
    except Exception as e:
        print(f"视频加载失败: {e}")
        return "", 404

# 提供默认封面图片
@app.route('/default-cover.png')
def serve_default_cover():
    try:
        default_path = os.path.join(app.static_folder, 'default-cover.png')
        if os.path.isfile(default_path):
            return send_file(default_path)
        
        # 如果默认图片不存在，尝试使用photos目录中的任何图片
        photos_dir = os.path.join(app.static_folder, 'photos')
        if os.path.exists(photos_dir):
            available_covers = [f for f in os.listdir(photos_dir) 
                              if f.endswith(('.png', '.jpg', '.jpeg'))]
            if available_covers:
                return send_from_directory(photos_dir, available_covers[0])
        
        return "Default cover not found", 404
        
    except Exception as e:
        print(f"Error serving default cover: {e}")
        return "Default cover not found", 404

# 获取数据库连接
def get_db_connection():
    try:
        conn = mysql.connector.connect(**db_config)
        return conn
    except mysql.connector.Error as err:
        print(f"数据库连接错误: {err}")
        return None

# 获取随机封面
def get_random_covers(count):
    try:
        # 确保photos目录存在
        if not os.path.exists(COVER_DIR):
            print(f"封面目录不存在: {COVER_DIR}")
            return ['default-cover.png'] * count
        
        # 获取所有图片文件
        image_files = []
        for ext in ['*.png', '*.jpg', '*.jpeg']:
            image_files.extend(glob.glob(os.path.join(COVER_DIR, ext)))
        
        if not image_files:
            print("没有找到任何图片文件")
            return ['default-cover.png'] * count
        
        # 随机选择不重复的图片
        if len(image_files) < count:
            # 如果图片数量不足，允许重复
            selected_files = [os.path.basename(random.choice(image_files)) for _ in range(count)]
        else:
            # 随机选择不重复的图片
            selected_files = [os.path.basename(img) for img in random.sample(image_files, count)]
        
        print(f"成功获取 {len(selected_files)} 张随机封面")
        return selected_files
            
    except Exception as e:
        print(f"获取随机封面时出错: {e}")
        return ['default-cover.png'] * count

# TV版动漫轮播API（episode > 1）
@app.route('/api/tv_anime', methods=['GET'])
def get_tv_anime():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "数据库连接失败"}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # 查询集数大于1的动漫
        query = """
        SELECT a.id, a.title, a.score, a.type, a.episodes, a.members, a.rank, a.popularity,
               GROUP_CONCAT(DISTINCT g.genre_name) as genres,
               GROUP_CONCAT(DISTINCT s.studio_name) as studios
        FROM top_anime a
        LEFT JOIN anime_genres ag ON a.id = ag.anime_id
        LEFT JOIN genres g ON ag.genre_id = g.genre_id
        LEFT JOIN anime_studios ast ON a.id = ast.anime_id
        LEFT JOIN studios s ON ast.studio_id = s.studio_id
        WHERE a.episodes > 1
        GROUP BY a.id
        ORDER BY RAND()
        LIMIT 5
        """
        
        cursor.execute(query)
        animes = cursor.fetchall()
        
        # 随机获取5个不重复的封面
        covers = get_random_covers(len(animes))
        
        # 为每个动漫添加封面
        for i, anime in enumerate(animes):
            anime['cover'] = covers[i]
        
        cursor.close()
        conn.close()
        
        return jsonify(animes)
    
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({"error": str(e)}), 500

# 剧场版动漫轮播API（episode = 1）
@app.route('/api/movie_anime', methods=['GET'])
def get_movie_anime():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "数据库连接失败"}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # 查询集数等于1的动漫
        query = """
        SELECT a.id, a.title, a.score, a.type, a.episodes, a.members, a.rank, a.popularity,
               GROUP_CONCAT(DISTINCT g.genre_name) as genres,
               GROUP_CONCAT(DISTINCT s.studio_name) as studios
        FROM top_anime a
        LEFT JOIN anime_genres ag ON a.id = ag.anime_id
        LEFT JOIN genres g ON ag.genre_id = g.genre_id
        LEFT JOIN anime_studios ast ON a.id = ast.anime_id
        LEFT JOIN studios s ON ast.studio_id = s.studio_id
        WHERE a.episodes = 1
        GROUP BY a.id
        ORDER BY RAND()
        LIMIT 5
        """
        
        cursor.execute(query)
        animes = cursor.fetchall()
        
        # 随机获取5个不重复的封面
        covers = get_random_covers(len(animes))
        
        # 为每个动漫添加封面
        for i, anime in enumerate(animes):
            anime['cover'] = covers[i]
        
        cursor.close()
        conn.close()
        
        return jsonify(animes)
    
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({"error": str(e)}), 500

# 排行榜API
@app.route('/api/ranking', methods=['GET'])
def get_ranking():
    limit = request.args.get('limit', 10, type=int)
    sort_by = request.args.get('sort', 'score')
    
    # 限制最多显示20条结果
    if limit > 20:
        limit = 20
    
    # 根据排序类型确定ORDER BY子句
    order_clause = ""
    if sort_by == 'score':
        order_clause = "ORDER BY a.score DESC"
    elif sort_by == 'popularity':
        order_clause = "ORDER BY a.popularity ASC"  # popularity数值越小代表越受欢迎
    elif sort_by == 'rank':
        order_clause = "ORDER BY a.rank ASC"  # rank数值越小代表排名越高
    else:
        order_clause = "ORDER BY a.score DESC"  # 默认按分数排序
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "数据库连接失败"}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        query = f"""
        SELECT a.id, a.title, a.score, a.type, a.episodes, a.members, a.rank, a.popularity,
               GROUP_CONCAT(DISTINCT g.genre_name) as genres,
               GROUP_CONCAT(DISTINCT s.studio_name) as studios
        FROM top_anime a
        LEFT JOIN anime_genres ag ON a.id = ag.anime_id
        LEFT JOIN genres g ON ag.genre_id = g.genre_id
        LEFT JOIN anime_studios ast ON a.id = ast.anime_id
        LEFT JOIN studios s ON ast.studio_id = s.studio_id
        GROUP BY a.id
        {order_clause}
        LIMIT %s
        """
        
        cursor.execute(query, (limit,))
        animes = cursor.fetchall()
        
        # 随机获取封面
        covers = get_random_covers(len(animes))
        
        # 为每个动漫添加封面
        for i, anime in enumerate(animes):
            anime['cover'] = covers[i]
        
        cursor.close()
        conn.close()
        
        return jsonify(animes)
    
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({"error": str(e)}), 500

# 热门推荐API
@app.route('/api/hot_recommend', methods=['GET'])
def get_hot_recommend():
    limit = request.args.get('limit', 10, type=int)
    
    # 限制最多显示20条结果
    if limit > 20:
        limit = 20
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "数据库连接失败"}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # 计算热力分数: score*0.7 + (1/popularity)*0.3
        # 注意：因为popularity越小越受欢迎，所以使用1/popularity
        query = """
        SELECT a.id, a.title, a.score, a.type, a.episodes, a.members, a.rank, a.popularity,
               GROUP_CONCAT(DISTINCT g.genre_name) as genres,
               GROUP_CONCAT(DISTINCT s.studio_name) as studios,
               (a.score * 0.7 + (1000000/a.popularity) * 0.3) as hot_score
        FROM top_anime a
        LEFT JOIN anime_genres ag ON a.id = ag.anime_id
        LEFT JOIN genres g ON ag.genre_id = g.genre_id
        LEFT JOIN anime_studios ast ON a.id = ast.anime_id
        LEFT JOIN studios s ON ast.studio_id = s.studio_id
        GROUP BY a.id
        ORDER BY hot_score DESC
        LIMIT %s
        """
        
        cursor.execute(query, (limit,))
        animes = cursor.fetchall()
        
        # 随机获取封面
        covers = get_random_covers(len(animes))
        
        # 为每个动漫添加封面
        for i, anime in enumerate(animes):
            anime['cover'] = covers[i]
        
        cursor.close()
        conn.close()
        
        return jsonify(animes)
    
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({"error": str(e)}), 500

# 创建用户搜索点击表、搜索词衰减表和动漫搜索相关性表的函数
def create_search_behavior_tables():
    """创建与搜索行为相关的表"""
    try:
        conn = get_db_connection()
        if not conn:
            print("无法连接到数据库")
            return False
        
        cursor = conn.cursor()
        
        # 创建用户搜索点击表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_search_clicks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                search_term VARCHAR(255) NOT NULL,
                anime_id INT NOT NULL,
                clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_search_term (search_term),
                INDEX idx_anime_id (anime_id)
            )
        ''')
        
        # 创建搜索词衰减表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS search_term_decay (
                user_id INT NOT NULL,
                search_term VARCHAR(255) NOT NULL,
                last_searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                search_count INT DEFAULT 1,
                decay_factor FLOAT DEFAULT 1.0,
                PRIMARY KEY (user_id, search_term),
                INDEX idx_user_id (user_id),
                INDEX idx_last_searched (last_searched_at)
            )
        ''')
        
        # 创建动漫搜索相关性表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS anime_search_relevance (
                anime_id INT NOT NULL,
                search_term VARCHAR(255) NOT NULL,
                click_weight FLOAT DEFAULT 0.0,
                search_weight FLOAT DEFAULT 0.0,
                total_relevance FLOAT DEFAULT 0.0,
                PRIMARY KEY (anime_id, search_term),
                INDEX idx_anime_id (anime_id),
                INDEX idx_search_term (search_term),
                INDEX idx_relevance (total_relevance)
            )
        ''')
        
        conn.commit()
        cursor.close()
        conn.close()
        print("创建搜索行为相关表成功")
        return True
    except Exception as e:
        print(f"创建搜索行为表失败: {e}")
        if 'conn' in locals() and conn:
            conn.close()
        return False

# 搜索动漫API
@app.route('/api/anime/search', methods=['GET'])
def search_anime():
    try:
        search_type = request.args.get('type', 'title')
        keyword = request.args.get('keyword', '').strip()
        user_id = request.args.get('user_id')  # 添加用户ID参数

        if not keyword:
            return jsonify({
                "error": "搜索关键词不能为空",
                "status": 400
            }), 400

        # 更新搜索词衰减
        if user_id:
            update_search_term_decay(user_id, keyword)

        conn = get_db_connection()
        if not conn:
            return jsonify({
                "error": "数据库连接失败",
                "status": 500
            }), 500

        cursor = conn.cursor(dictionary=True)

        base_query = """
            SELECT 
                a.id, a.title, a.score, a.type, a.episodes, a.members, a.rank, a.popularity,
                GROUP_CONCAT(DISTINCT g.genre_name) as genres,
                GROUP_CONCAT(DISTINCT s.studio_name) as studios
            FROM top_anime a
            LEFT JOIN anime_genres ag ON a.id = ag.anime_id
            LEFT JOIN genres g ON ag.genre_id = g.genre_id
            LEFT JOIN anime_studios ast ON a.id = ast.anime_id
            LEFT JOIN studios s ON ast.studio_id = s.studio_id
        """

        if search_type == 'title':
            where_clause = "WHERE a.title LIKE %s"
            param = f"%{keyword}%"
        elif search_type == 'genre':
            where_clause = "WHERE g.genre_name LIKE %s"
            param = f"%{keyword}%"
        elif search_type == 'studio':
            where_clause = "WHERE s.studio_name LIKE %s"
            param = f"%{keyword}%"
        else:
            return jsonify({
                "error": "无效的搜索类型",
                "status": 400
            }), 400

        full_query = f"""
            {base_query}
            {where_clause}
            GROUP BY a.id
            ORDER BY a.score DESC
            LIMIT 20
        """

        cursor.execute(full_query, (param,))
        results = cursor.fetchall()

        # 更新搜索结果中每个动漫的search_weight
        for anime in results:
            update_anime_search_relevance(anime['id'], keyword, is_search=True)

        # 处理结果
        for item in results:
            if item['genres']:
                item['genres'] = item['genres'].split(',')
            else:
                item['genres'] = []
            
            if item['studios']:
                item['studios'] = item['studios'].split(',')
            else:
                item['studios'] = []

        cursor.close()
        conn.close()

        return jsonify({
            "count": len(results),
            "results": results,
            "status": 200
        })

    except Exception as e:
        print(f"搜索失败: {str(e)}")
        if 'conn' in locals() and conn:
            conn.close()
        return jsonify({
            "error": f"搜索失败: {str(e)}",
            "status": 500
        }), 500

# 更新搜索词衰减因子
def update_search_term_decay(user_id, search_term):
    try:
        conn = get_db_connection()
        if not conn:
            return False
        
        cursor = conn.cursor()
        
        # 检查搜索词是否存在
        cursor.execute('''
            SELECT last_searched_at, search_count, decay_factor 
            FROM search_term_decay 
            WHERE user_id = %s AND search_term = %s
        ''', (user_id, search_term))
        
        result = cursor.fetchone()
        current_time = datetime.now()
        
        if result:
            # 更新已存在的搜索词
            last_searched, search_count, old_decay = result
            time_diff = (current_time - last_searched).total_seconds() / 3600  # 转换为小时
            
            # 计算新的衰减因子
            new_decay = old_decay * math.exp(-0.1 * time_diff)  # 使用指数衰减
            new_count = search_count + 1
            
            cursor.execute('''
                UPDATE search_term_decay 
                SET last_searched_at = %s,
                    search_count = %s,
                    decay_factor = %s
                WHERE user_id = %s AND search_term = %s
            ''', (current_time, new_count, new_decay, user_id, search_term))
        else:
            # 插入新的搜索词
            cursor.execute('''
                INSERT INTO search_term_decay 
                (user_id, search_term, last_searched_at, search_count, decay_factor)
                VALUES (%s, %s, %s, 1, 1.0)
            ''', (user_id, search_term, current_time))
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"更新搜索词衰减失败: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            cursor.close()
            conn.close()

# 更新动漫搜索相关度
def update_anime_search_relevance(anime_id, search_term, is_search=False):
    try:
        conn = get_db_connection()
        if not conn:
            return False
        
        cursor = conn.cursor()
        
        # 检查相关度记录是否存在
        cursor.execute('''
            SELECT click_weight, search_weight 
            FROM anime_search_relevance 
            WHERE anime_id = %s AND search_term = %s
        ''', (anime_id, search_term))
        
        result = cursor.fetchone()
        
        if result:
            # 更新已存在的记录
            click_weight, search_weight = result
            if is_search:
                # 如果是搜索操作，增加search_weight
                new_search_weight = search_weight + 1.0
                cursor.execute('''
                    UPDATE anime_search_relevance 
                    SET search_weight = %s
                    WHERE anime_id = %s AND search_term = %s
                ''', (new_search_weight, anime_id, search_term))
            else:
                # 如果是点击操作，增加click_weight
                new_click_weight = click_weight + 1.0
                cursor.execute('''
                    UPDATE anime_search_relevance 
                    SET click_weight = %s
                    WHERE anime_id = %s AND search_term = %s
                ''', (new_click_weight, anime_id, search_term))
        else:
            # 插入新记录
            if is_search:
                cursor.execute('''
                    INSERT INTO anime_search_relevance 
                    (anime_id, search_term, click_weight, search_weight)
                    VALUES (%s, %s, 0.0, 1.0)
                ''', (anime_id, search_term))
            else:
                cursor.execute('''
                    INSERT INTO anime_search_relevance 
                    (anime_id, search_term, click_weight, search_weight)
                    VALUES (%s, %s, 1.0, 0.0)
                ''', (anime_id, search_term))
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"更新动漫搜索相关度失败: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            cursor.close()
            conn.close()

# 记录用户搜索点击
@app.route('/api/record_click', methods=['POST'])
def record_search_click():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '请求数据为空'}), 400
        
        user_id = data.get('user_id')
        search_term = data.get('search_term')
        anime_id = data.get('anime_id')
        
        if not user_id or not search_term or not anime_id:
            return jsonify({'success': False, 'error': '缺少必要参数'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': '数据库连接失败'}), 500
        
        cursor = conn.cursor()
        
        try:
            # 1. 记录点击事件
            cursor.execute('''
                INSERT INTO user_search_clicks 
                (user_id, search_term, anime_id, clicked_at) 
                VALUES (%s, %s, %s, NOW())
            ''', (user_id, search_term, anime_id))
            
            # 2. 更新搜索词衰减
            update_search_term_decay(user_id, search_term)
            
            # 3. 更新动漫搜索相关度（增加click_weight）
            update_anime_search_relevance(anime_id, search_term, is_search=False)
            
            conn.commit()
            return jsonify({'success': True, 'message': '点击记录成功'})
            
        except Exception as e:
            conn.rollback()
            print(f"记录点击失败: {e}")
            return jsonify({'success': False, 'error': f'记录点击失败: {str(e)}'}), 500
            
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        print(f"处理点击记录请求失败: {e}")
        return jsonify({'success': False, 'error': f'处理请求失败: {str(e)}'}), 500

# 个性化推荐API
@app.route('/api/personal_recommend', methods=['GET'])
def get_personal_recommend():
    try:
        user_id = request.args.get('user_id')
        print(f"开始处理个性化推荐请求，用户ID: {user_id}")
        
        if not user_id:
            print("错误：用户ID为空")
            return jsonify({
                'status': 'error',
                'message': '用户ID不能为空',
                'data': []
            })
        
        conn = get_db_connection()
        if not conn:
            print("错误：数据库连接失败")
            return jsonify({
                'status': 'error',
                'message': '数据库连接失败',
                'data': []
            })
            
        cursor = conn.cursor(dictionary=True)
        
        # 1. 获取用户收藏的动漫及其类型和工作室
        print("获取用户收藏的动漫信息...")
        cursor.execute('''
            SELECT a.id, a.title, a.score, a.type, a.episodes, a.members, a.rank, a.popularity,
                   GROUP_CONCAT(DISTINCT g.genre_name) as genres,
                   GROUP_CONCAT(DISTINCT s.studio_name) as studios
            FROM user_favorites uf
            JOIN top_anime a ON uf.anime_id = a.id
            LEFT JOIN anime_genres ag ON a.id = ag.anime_id
            LEFT JOIN genres g ON ag.genre_id = g.genre_id
            LEFT JOIN anime_studios ast ON a.id = ast.anime_id
            LEFT JOIN studios s ON ast.studio_id = s.studio_id
            WHERE uf.user_id = %s
            GROUP BY a.id
            ORDER BY uf.created_at DESC
            LIMIT 10
        ''', (user_id,))
        favorite_animes = cursor.fetchall()
        print(f"找到 {len(favorite_animes)} 个收藏的动漫")
        
        # 2. 获取用户最近的搜索点击记录
        print("获取用户搜索记录...")
        cursor.execute('''
            SELECT a.id, a.title, a.score, a.type, a.episodes, a.members, a.rank, a.popularity,
                   GROUP_CONCAT(DISTINCT g.genre_name) as genres,
                   GROUP_CONCAT(DISTINCT s.studio_name) as studios,
                   usc.search_term, usc.clicked_at
            FROM user_search_clicks usc
            JOIN top_anime a ON usc.anime_id = a.id
            LEFT JOIN anime_genres ag ON a.id = ag.anime_id
            LEFT JOIN genres g ON ag.genre_id = g.genre_id
            LEFT JOIN anime_studios ast ON a.id = ast.anime_id
            LEFT JOIN studios s ON ast.studio_id = s.studio_id
            WHERE usc.user_id = %s
            GROUP BY a.id, usc.search_term, usc.clicked_at
            ORDER BY usc.clicked_at DESC
            LIMIT 20
        ''', (user_id,))
        recent_clicks = cursor.fetchall()
        print(f"找到 {len(recent_clicks)} 条搜索记录")
        
        # 3. 获取用户搜索词的衰减因子
        print("获取搜索词衰减因子...")
        cursor.execute('''
            SELECT search_term, decay_factor 
            FROM search_term_decay 
            WHERE user_id = %s 
            ORDER BY last_searched_at DESC 
            LIMIT 10
        ''', (user_id,))
        search_decays = {row['search_term']: row['decay_factor'] for row in cursor.fetchall()}
        print(f"找到 {len(search_decays)} 个搜索词衰减因子")
        
        # 4. 构建推荐查询
        recommendations = []
        
        # 4.1 基于收藏的推荐
        if favorite_animes:
            print("基于收藏生成推荐...")
            # 提取收藏动漫的类型和工作室
            favorite_genres = set()
            favorite_studios = set()
            for anime in favorite_animes:
                if anime['genres']:
                    favorite_genres.update(anime['genres'].split(','))
                if anime['studios']:
                    favorite_studios.update(anime['studios'].split(','))
            
            # 构建IN子句的占位符
            genre_placeholders = ','.join(['%s'] * len(favorite_genres)) if favorite_genres else 'NULL'
            studio_placeholders = ','.join(['%s'] * len(favorite_studios)) if favorite_studios else 'NULL'
            
            # 查询相似动漫
            query = f'''
                SELECT DISTINCT a.id, a.title, a.score, a.type, a.episodes, a.members, a.rank, a.popularity,
                       GROUP_CONCAT(DISTINCT g.genre_name) as genres,
                       GROUP_CONCAT(DISTINCT s.studio_name) as studios,
                       COUNT(DISTINCT CASE WHEN g.genre_name IN ({genre_placeholders}) THEN g.genre_name END) as genre_match,
                       COUNT(DISTINCT CASE WHEN s.studio_name IN ({studio_placeholders}) THEN s.studio_name END) as studio_match
                FROM top_anime a
                LEFT JOIN anime_genres ag ON a.id = ag.anime_id
                LEFT JOIN genres g ON ag.genre_id = g.genre_id
                LEFT JOIN anime_studios ast ON a.id = ast.anime_id
                LEFT JOIN studios s ON ast.studio_id = s.studio_id
                WHERE a.id NOT IN (
                    SELECT anime_id FROM user_favorites WHERE user_id = %s
                )
                GROUP BY a.id
                HAVING genre_match > 0 OR studio_match > 0
                ORDER BY (genre_match + studio_match) DESC, a.score DESC
                LIMIT 10
            '''
            
            # 准备参数
            params = list(favorite_genres) + list(favorite_studios) + [user_id]
            cursor.execute(query, params)
            
            favorite_based_recommendations = cursor.fetchall()
            print(f"基于收藏生成了 {len(favorite_based_recommendations)} 条推荐")
            recommendations.extend(favorite_based_recommendations)
        
        # 4.2 基于搜索行为的推荐
        if recent_clicks:
            print("基于搜索行为生成推荐...")
            # 计算搜索词权重
            search_weights = {}
            for click in recent_clicks:
                decay = search_decays.get(click['search_term'], 1.0)
                search_weights[click['search_term']] = search_weights.get(click['search_term'], 0) + decay
            
            # 获取相关度最高的动漫
            for search_term, weight in sorted(search_weights.items(), key=lambda x: x[1], reverse=True)[:3]:
                cursor.execute('''
                    SELECT a.id, a.title, a.score, a.type, a.episodes, a.members, a.rank, a.popularity,
                           GROUP_CONCAT(DISTINCT g.genre_name) as genres,
                           GROUP_CONCAT(DISTINCT s.studio_name) as studios,
                           (r.click_weight * 1.0 + r.search_weight * %s) as effective_relevance
                    FROM top_anime a
                    JOIN anime_search_relevance r ON a.id = r.anime_id
                    LEFT JOIN anime_genres ag ON a.id = ag.anime_id
                    LEFT JOIN genres g ON ag.genre_id = g.genre_id
                    LEFT JOIN anime_studios ast ON a.id = ast.anime_id
                    LEFT JOIN studios s ON ast.studio_id = s.studio_id
                    WHERE r.search_term = %s
                    AND a.id NOT IN (
                        SELECT anime_id FROM user_favorites WHERE user_id = %s
                    )
                    GROUP BY a.id
                    ORDER BY effective_relevance DESC
                    LIMIT 3
                ''', (weight, search_term, user_id))
                recommendations.extend(cursor.fetchall())
            print(f"基于搜索行为生成 {len(recommendations)} 个推荐")
        
        # 5. 去重和排序
        print("去重和排序推荐...")
        seen_ids = set()
        unique_recommendations = []
        for anime in recommendations:
            if anime['id'] not in seen_ids:
                seen_ids.add(anime['id'])
                unique_recommendations.append(anime)
        print(f"去重后剩余 {len(unique_recommendations)} 个推荐")
        
        # 6. 如果推荐数量不足，补充热门推荐
        if len(unique_recommendations) < 10:
            print("补充热门推荐...")
            # 构建IN子句的占位符
            seen_ids_placeholders = ','.join(['%s'] * len(seen_ids)) if seen_ids else 'NULL'
            
            query = f'''
                SELECT a.id, a.title, a.score, a.type, a.episodes, a.members, a.rank, a.popularity,
                       GROUP_CONCAT(DISTINCT g.genre_name) as genres,
                       GROUP_CONCAT(DISTINCT s.studio_name) as studios
                FROM top_anime a
                LEFT JOIN anime_genres ag ON a.id = ag.anime_id
                LEFT JOIN genres g ON ag.genre_id = g.genre_id
                LEFT JOIN anime_studios ast ON a.id = ast.anime_id
                LEFT JOIN studios s ON ast.studio_id = s.studio_id
                WHERE a.id NOT IN (
                    SELECT anime_id FROM user_favorites WHERE user_id = %s
                )
                AND a.id NOT IN ({seen_ids_placeholders})
                GROUP BY a.id
                ORDER BY a.score DESC, a.members DESC
                LIMIT %s
            '''
            
            # 准备参数
            params = [user_id] + list(seen_ids) + [10 - len(unique_recommendations)]
            cursor.execute(query, params)
            
            for anime in cursor.fetchall():
                if anime['id'] not in seen_ids:
                    unique_recommendations.append(anime)
            print(f"补充后共有 {len(unique_recommendations)} 个推荐")
        
        # 7. 为每个推荐添加随机封面
        print("添加随机封面...")
        for anime in unique_recommendations:
            try:
                covers = get_random_covers(1)
                if covers and len(covers) > 0:
                    anime['cover'] = covers[0]
                else:
                    anime['cover'] = 'default-cover.png'
            except Exception as e:
                print(f"为动漫 {anime.get('id', 'unknown')} 添加封面时出错: {e}")
                anime['cover'] = 'default-cover.png'
        
        cursor.close()
        conn.close()
        
        print("返回推荐结果")
        return jsonify({
            'status': 'success',
            'message': '获取推荐成功',
            'data': unique_recommendations[:10]  # 最多返回10个推荐
        })
        
    except Exception as e:
        print(f"获取个性化推荐失败: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': '获取推荐失败，请稍后再试',
            'data': []
        })

# 获取用户收藏列表API
@app.route('/api/user_favorites', methods=['GET'])
def get_user_favorites():
    user_id = request.args.get('user_id')
    
    if not user_id:
        return jsonify({"error": "用户ID不能为空"}), 400
    
    try:
        # 尝试连接数据库
        conn = get_db_connection()
        if not conn:
            # 如果数据库连接失败，返回空列表
            print(f"数据库连接失败，用户ID: {user_id}")
            return jsonify([])
        
        cursor = conn.cursor(dictionary=True)
        
        # 首先检查用户是否存在
        try:
            check_user_query = "SELECT * FROM user WHERE user_id = %s"
            cursor.execute(check_user_query, (user_id,))
            user = cursor.fetchone()
            
            if not user:
                print(f"用户不存在: {user_id}")
                cursor.close()
                conn.close()
                return jsonify([])  # 用户不存在，返回空列表
        except Exception as user_check_error:
            print(f"检查用户时出错: {str(user_check_error)}")
            # 继续执行，不因为用户检查错误中断
        
        # 检查user_favorites表是否存在
        try:
            check_table_query = "SHOW TABLES LIKE 'user_favorites'"
            cursor.execute(check_table_query)
            if not cursor.fetchone():
                print("user_favorites表不存在")
                cursor.close()
                conn.close()
                return jsonify([])  # 表不存在，返回空列表
        except Exception as table_check_error:
            print(f"检查表时出错: {str(table_check_error)}")
            # 继续执行，不因为表检查错误中断
        
        # 查询收藏
        try:
            # 修改查询，使用created_at字段替代favorite_date
            query = """
            SELECT a.id, a.title, a.score, a.type, a.episodes, a.members, a.rank, a.popularity,
                   GROUP_CONCAT(DISTINCT g.genre_name) as genres,
                   GROUP_CONCAT(DISTINCT s.studio_name) as studios,
                   uf.created_at
            FROM user_favorites uf
            JOIN top_anime a ON uf.anime_id = a.id
            LEFT JOIN anime_genres ag ON a.id = ag.anime_id
            LEFT JOIN genres g ON ag.genre_id = g.genre_id
            LEFT JOIN anime_studios ast ON a.id = ast.anime_id
            LEFT JOIN studios s ON ast.studio_id = s.studio_id
            WHERE uf.user_id = %s
            GROUP BY a.id
            ORDER BY uf.created_at DESC
            """
            
            cursor.execute(query, (user_id,))
            favorites = cursor.fetchall()
            
            # 如果没有收藏，返回空列表
            if not favorites:
                print(f"用户 {user_id} 没有收藏")
                cursor.close()
                conn.close()
                return jsonify([])
            
            # 随机获取封面
            covers = get_random_covers(len(favorites))
            
            # 为每个动漫添加封面
            for i, anime in enumerate(favorites):
                anime['cover'] = covers[i]
            
            cursor.close()
            conn.close()
            
            return jsonify(favorites)
        except Exception as query_error:
            print(f"执行收藏查询时出错: {str(query_error)}")
            if conn:
                cursor.close()
                conn.close()
            
            # 返回空列表而不是错误，允许前端优雅降级
            return jsonify([])
    
    except Exception as e:
        print(f"获取用户收藏时遇到未处理的错误: {str(e)}")
        # 返回空列表而不是500错误
        return jsonify([])

# 检查是否已收藏
@app.route('/api/check_favorite', methods=['GET'])
def check_favorite():
    """
    检查动漫是否在用户的收藏列表中
    参数:
        user_id: 用户ID
        anime_id: 动漫ID
    返回:
        JSON对象，包含is_favorited字段表示是否已收藏
    """
    try:
        user_id = request.args.get('user_id')
        anime_id = request.args.get('anime_id')
        
        if not user_id or not anime_id:
            return jsonify({'error': '缺少必要参数'}), 400
            
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '数据库连接失败'}), 500
            
        cursor = conn.cursor()
        
        # 查询用户收藏中是否存在该动漫
        cursor.execute('''
            SELECT COUNT(*) FROM user_favorites 
            WHERE user_id = %s AND anime_id = %s
        ''', (user_id, anime_id))
        
        count = cursor.fetchone()[0]
        is_favorited = count > 0
        
        cursor.close()
        conn.close()
        
        return jsonify({'is_favorited': is_favorited})
        
    except Exception as e:
        print(f"Error checking favorite status: {e}")
        return jsonify({'error': '检查收藏状态失败', 'details': str(e)}), 500

# 用户登录API
@app.route('/api/auth/login', methods=['POST'])
def login():
    """登录接口"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'error': '用户名和密码不能为空'})
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': '数据库连接失败'})
    
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM user WHERE username = %s", (username,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'success': False, 'error': '该用户不存在，请注册'})
        
        if user['password'] != password:
            return jsonify({'success': False, 'error': '密码错误'})
        
        # 生成简单token
        token = str(uuid.uuid4())
        return jsonify({
            'success': True,
            'user_id': user['user_id'],
            'token': token,
            'username': username
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'服务器错误: {str(e)}'})
    finally:
        if conn:
            cursor.close()
            conn.close()

# 用户注册API
@app.route('/api/auth/register', methods=['POST'])
def register():
    """注册接口"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'error': '用户名和密码不能为空'})
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': '数据库连接失败'})
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # 检查用户名是否已存在
        cursor.execute("SELECT * FROM user WHERE username = %s", (username,))
        if cursor.fetchone():
            return jsonify({'success': False, 'error': '用户名已存在'})
        
        # 插入新用户，让数据库自动生成user_id
        cursor.execute(
            "INSERT INTO user (username, password) VALUES (%s, %s)",
            (username, password)
        )
        conn.commit()
        
        # 获取新插入的用户ID
        user_id = cursor.lastrowid
        
        # 生成简单token
        token = str(uuid.uuid4())
        return jsonify({
            'success': True,
            'user_id': user_id,
            'token': token,
            'username': username
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'注册失败: {str(e)}'})
    finally:
        if conn:
            cursor.close()
            conn.close()

# 动态生成可视化图表API
@app.route('/api/visualize', methods=['POST'])
def visualize_anime():
    data = request.json
    titles = data.get('titles', [])
    
    if not titles:
        return jsonify({"error": "未提供动漫标题"}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "数据库连接失败"}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # 查询匹配的动漫数据
        placeholders = ', '.join(['%s'] * len(titles))
        query = f"""
        SELECT a.id, a.title, a.score, a.type, a.episodes, a.members, a.rank, a.popularity,
               GROUP_CONCAT(DISTINCT g.genre_name) as genres,
               GROUP_CONCAT(DISTINCT s.studio_name) as studios
        FROM top_anime a
        LEFT JOIN anime_genres ag ON a.id = ag.anime_id
        LEFT JOIN genres g ON ag.genre_id = g.genre_id
        LEFT JOIN anime_studios ast ON a.id = ast.anime_id
        LEFT JOIN studios s ON ast.studio_id = s.studio_id
        WHERE a.title IN ({placeholders})
        GROUP BY a.id
        """
        
        cursor.execute(query, titles)
        anime_data = cursor.fetchall()
        
        # 如果没有找到数据，使用模拟数据
        if not anime_data:
            anime_data = get_mock_visualization_data(titles)
        
        # 为每个动漫随机获取一个封面
        covers = get_random_covers(len(anime_data))
        for i, anime in enumerate(anime_data):
            anime['cover'] = covers[i]
        
        # 生成不同类型的图表数据
        chart_data = generate_chart_data(anime_data)
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "charts": chart_data,
            "animes": anime_data
        })
    
    except Exception as e:
        if conn:
            conn.close()
        print(f"生成可视化数据时出错: {str(e)}")
        return jsonify({"error": str(e)}), 500

# 生成模拟的可视化数据
def get_mock_visualization_data(titles):
    mock_data = []
    genres = ["Action", "Comedy", "Drama", "Fantasy", "Sci-Fi", "Slice of Life", "Romance"]
    studios = ["Studio Ghibli", "Kyoto Animation", "MAPPA", "Ufotable", "Bones", "Madhouse"]
    
    for i, title in enumerate(titles):
        # 为每个标题创建一个模拟数据
        score = round(random.uniform(6.0, 9.5), 1)
        members = random.randint(100000, 2000000)
        episodes = random.randint(1, 26) if random.random() > 0.2 else 1  # 20%的概率是剧场版
        
        # 随机选择2-4个类型
        title_genres = random.sample(genres, random.randint(2, min(4, len(genres))))
        
        # 随机选择1-2个工作室
        title_studios = random.sample(studios, random.randint(1, min(2, len(studios))))
        
        mock_data.append({
            "id": i + 1,
            "title": title,
            "score": score,
            "type": "Movie" if episodes == 1 else "TV",
            "episodes": episodes,
            "members": members,
            "rank": random.randint(1, 1000),
            "popularity": random.randint(1, 2000),
            "genres": ",".join(title_genres),
            "studios": ",".join(title_studios)
        })
    
    return mock_data

# 根据动漫数据生成图表数据
def generate_chart_data(anime_data):
    charts = []
    
    # 1. 生成饼状图数据 - 类型分布
    pie_chart = {
        "id": "pie-chart",
        "title": "动漫类型分布饼状图",
        "description": "展示不同标签在所选动漫中的分布比例",
        "imageUrl": generate_genre_pie_chart(anime_data),
        "type": "pie"
    }
    charts.append(pie_chart)
    
    # 2. 生成多折线图数据 - 集数与用户数关系
    line_chart = {
        "id": "line-chart",
        "title": "集数与用户数关系折线图",
        "description": "分析不同动漫的集数与用户数的关系",
        "imageUrl": generate_episodes_members_line_chart(anime_data),
        "type": "line"
    }
    charts.append(line_chart)
    
    # 3. 生成评分分布柱状图
    bar_chart = {
        "id": "bar-chart",
        "title": "评分分布柱状图",
        "description": "展示动漫评分的分布情况",
        "imageUrl": generate_score_distribution_chart(anime_data),
        "type": "bar"
    }
    charts.append(bar_chart)
    
    # 4. 生成气泡图 - 观众-集数-评分
    bubble_chart = {
        "id": "bubble-chart",
        "title": "观众-集数-评分气泡图",
        "description": "通过气泡大小表示集数，分析观众数量与评分的关系",
        "imageUrl": generate_bubble_chart(anime_data),
        "type": "bubble"
    }
    charts.append(bubble_chart)
    
    return charts

# 生成饼状图 - 动漫类型分布
def generate_genre_pie_chart(anime_data):
    # 收集所有类型
    all_genres = []
    for anime in anime_data:
        if anime.get('genres'):
            try:
                genres = anime['genres'].split(',')
                all_genres.extend([g.strip() for g in genres if g.strip()])
            except (AttributeError, TypeError):
                # 跳过无法处理的类型数据
                continue
    
    # 统计类型频率
    genre_counts = Counter(all_genres)
    
    # 获取前10个最常见的类型（或全部如果少于10个）
    top_genres = genre_counts.most_common(10)
    
    # 如果数据为空，返回默认图片
    if not top_genres:
        return "photos/1.png"
    
    # 提取标签和数量
    labels = [g[0] for g in top_genres]
    sizes = [g[1] for g in top_genres]
    
    # 为了美观，计算用于突出显示的偏移值（wedgeprops）
    explode = [0.1 if i == 0 else 0 for i in range(len(labels))]
    
    # 创建图表
    plt.figure(figsize=(10, 8))
    plt.clf()
    
    # 使用饼状图
    wedges, texts, autotexts = plt.pie(
        sizes, 
        explode=explode, 
        labels=None,  # 不在饼图上直接显示标签
        autopct='%1.1f%%',
        shadow=True, 
        startangle=90,
        textprops={'fontsize': 14}
    )
    
    # 设置自动文本的字体大小
    for autotext in autotexts:
        autotext.set_fontsize(12)
    
    # 添加图例并放在左上角
    plt.legend(
        wedges, 
        labels,
        title="动漫类型",
        loc="upper left",
        fontsize=12
    )
    
    plt.title('动漫类型分布', fontsize=20)
    plt.axis('equal')  # 使饼图为正圆形
    
    # 将图表转换为base64编码的图片
    img_data = get_image_base64()
    
    return img_data

# 生成多折线图 - 集数与用户数关系
def generate_episodes_members_line_chart(anime_data):
    # 如果数据为空，返回默认图片
    if not anime_data:
        return "photos/2.png"
    
    # 创建图表，增加高度以适应水平标签
    fig, ax1 = plt.subplots(figsize=(12, 10))
    
    # 按标题字母顺序排序，以便于比较
    sorted_anime = sorted(anime_data, key=lambda x: x.get('title', ''))
    
    # 提取数据并处理None值
    valid_data = []
    for i, anime in enumerate(sorted_anime):
        title = anime.get('title', f'动漫{i+1}')
        episode = anime.get('episodes')
        member = anime.get('members')
        
        if episode is not None and member is not None:
            try:
                valid_data.append({
                    'title': title,
                    'episodes': float(episode),
                    'members': float(member)
                })
            except (ValueError, TypeError):
                continue
    
    # 如果没有有效数据，返回默认图片
    if not valid_data:
        return "photos/2.png"
    
    # 从有效数据中提取值
    titles = [item['title'] for item in valid_data]
    episodes = [item['episodes'] for item in valid_data]
    members = [item['members'] for item in valid_data]
    
    # 第一个Y轴 - 集数
    color = 'tab:blue'
    ax1.set_xlabel('动漫名称', fontsize=14)
    ax1.set_ylabel('集数', color=color, fontsize=14)
    line1 = ax1.plot(titles, episodes, 'o-', color=color, linewidth=3, markersize=10, label='集数')
    ax1.tick_params(axis='y', labelcolor=color)
    
    # 设置x轴标签为水平显示并换行
    plt.xticks(rotation=0)
    ax1.set_xticklabels([textwrap.fill(title, width=20) for title in titles])
    
    # 第二个Y轴 - 用户数
    ax2 = ax1.twinx()
    color = 'tab:red'
    ax2.set_ylabel('用户数', color=color, fontsize=14)
    line2 = ax2.plot(titles, members, 's-', color=color, linewidth=3, markersize=10, label='用户数')
    ax2.tick_params(axis='y', labelcolor=color)
    
    # 使刻度对齐到整数
    ax1.yaxis.set_major_locator(MaxNLocator(integer=True))
    
    # 合并图例并放在左上角
    lines = line1 + line2
    labels = [l.get_label() for l in lines]
    ax1.legend(lines, labels, loc='upper left', fontsize=12)
    
    plt.title('集数与用户数关系分析', fontsize=20)
    
    # 调整布局以适应水平标签
    plt.tight_layout()
    
    # 添加数据点注释
    for i, (x, y) in enumerate(zip(titles, episodes)):
        ax1.annotate(f'{int(y)}', (x, y), textcoords="offset points", 
                    xytext=(0,10), ha='center', fontsize=10)
    
    for i, (x, y) in enumerate(zip(titles, members)):
        ax2.annotate(f'{int(y)}', (x, y), textcoords="offset points", 
                    xytext=(0,-15), ha='center', fontsize=10)
    
    # 将图表转换为base64编码的图片
    img_data = get_image_base64()
    
    return img_data

# 修改评分分布图函数，使每个动漫都有一条柱
def generate_score_distribution_chart(anime_data):
    # 如果数据为空，返回默认图片
    if not anime_data:
        return "photos/3.png"
    
    # 提取评分数据和标题
    valid_anime = []
    for anime in anime_data:
        score = anime.get('score')
        title = anime.get('title')
        if score is not None and title is not None:
            try:
                valid_anime.append({
                    'title': title,
                    'score': float(score)
                })
            except (ValueError, TypeError):
                continue
    
    # 如果没有有效的评分数据，返回默认图片
    if not valid_anime:
        return "photos/3.png"
    
    # 按评分排序
    valid_anime.sort(key=lambda x: x['score'])
    
    # 提取排序后的数据
    titles = [anime['title'] for anime in valid_anime]
    scores = [anime['score'] for anime in valid_anime]
    
    # 计算平均分
    avg_score = sum(scores) / len(scores) if scores else 0
    
    # 创建图表，增加高度以适应水平标签
    plt.figure(figsize=(14, 10))
    plt.clf()
    
    # 根据动漫数量调整柱宽
    anime_count = len(valid_anime)
    bar_width = max(0.5, 10.0 / anime_count)
    
    # 生成x轴位置
    x_pos = np.arange(len(titles))
    
    # 绘制柱状图，每个动漫一条柱
    bars = plt.bar(x_pos, scores, width=bar_width, color='skyblue', 
                   alpha=0.7, edgecolor='black', linewidth=1.0)
    
    # 设置x轴标签为水平显示并换行
    plt.xticks(x_pos, [textwrap.fill(title, width=20) for title in titles], rotation=0)
    
    # 添加柱上的评分标签
    if anime_count <= 20:
        for i, bar in enumerate(bars):
            plt.text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.1,
                    f'{scores[i]:.1f}', ha='center', va='bottom', fontsize=10)
    
    # 添加平均分线
    plt.axhline(y=avg_score, color='red', linestyle='--', linewidth=2, label=f'平均分: {avg_score:.2f}')
    
    # 设置标题和轴标签
    plt.xlabel('动漫名称', fontsize=14)
    plt.ylabel('评分', fontsize=14)
    plt.title('动漫评分分布', fontsize=20)
    
    # 设置y轴范围
    min_score = min(scores) if scores else 0
    max_score = max(scores) if scores else 10
    y_margin = (max_score - min_score) * 0.1
    plt.ylim(max(0, min_score - y_margin), max_score + y_margin)
    
    # 图例放在左上角
    plt.legend(fontsize=12, loc='upper left')
    
    # 添加网格线
    plt.grid(True, linestyle='--', alpha=0.7, axis='y')
    
    # 调整布局以适应水平标签
    plt.tight_layout()
    
    # 将图表转换为base64编码的图片
    img_data = get_image_base64()
    
    return img_data

# 生成气泡图 - 观众-集数-评分
def generate_bubble_chart(anime_data):
    # 如果数据为空，返回默认图片
    if not anime_data:
        return "photos/4.png"
    
    # 提取数据并处理None值
    scores = []
    members = []
    episodes = []
    titles = []
    
    for i, anime in enumerate(anime_data):
        score = anime.get('score')
        member = anime.get('members')
        episode = anime.get('episodes')
        title = anime.get('title', f'动漫{i+1}')
        
        if score is not None and member is not None and episode is not None:
            try:
                scores.append(float(score))
                members.append(float(member))
                episodes.append(float(episode))
                titles.append(title)
            except (ValueError, TypeError):
                continue
    
    # 如果没有有效数据，返回默认图片
    if not scores or not members or not episodes:
        return "photos/4.png"
    
    # 创建图表，增加高度以适应水平标签
    fig, ax = plt.subplots(figsize=(12, 10))
    plt.clf()
    
    # 计算气泡大小
    sizes = [np.sqrt(ep) * 50 for ep in episodes]
    
    # 创建颜色映射
    try:
        cmap = plt.colormaps['viridis']
    except:
        cmap = cm.get_cmap('viridis')
    
    norm = plt.Normalize(min(episodes), max(episodes))
    colors = [cmap(norm(ep)) for ep in episodes]
    
    # 绘制气泡图
    scatter = plt.scatter(scores, members, s=sizes, c=colors, alpha=0.6, edgecolors='black')
    
    plt.xlabel('评分', fontsize=14)
    plt.ylabel('观众数量', fontsize=14)
    plt.title('观众-集数-评分关系图', fontsize=20)
    
    # 添加颜色条
    cbar = plt.colorbar(scatter, orientation='horizontal', pad=0.1, aspect=40, shrink=0.5)
    cbar.ax.set_title('集数', fontsize=12)
    
    # 添加图例说明气泡大小
    episode_sizes = [min(episodes), (min(episodes) + max(episodes))/2, max(episodes)]
    legend_sizes = [np.sqrt(ep) * 50 for ep in episode_sizes]
    
    for i, size in enumerate(legend_sizes):
        plt.scatter([], [], c='gray', alpha=0.6, s=size, 
                   label=f'集数: {int(episode_sizes[i])}', edgecolors='black')
    
    plt.legend(loc='upper left', fontsize=12, title="气泡大小参考")
    
    # 添加网格线
    plt.grid(True, linestyle='--', alpha=0.3)
    
    # 为每个点添加标签，使用textwrap进行换行
    for i, title in enumerate(titles):
        wrapped_title = textwrap.fill(title, width=20)
        plt.annotate(
            wrapped_title,
            (scores[i], members[i]),
            textcoords="offset points",
            xytext=(0, 10),
            ha='center',
            fontsize=10
        )
    
    # 调整布局以适应水平标签
    plt.tight_layout()
    
    # 将图表转换为base64编码的图片
    img_data = get_image_base64()
    
    return img_data

# 将matplotlib图表转换为base64编码的图片
def get_image_base64():
    # 创建内存中的图片缓冲区
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    buf.seek(0)
    
    # 将图片转换为base64编码
    img_str = base64.b64encode(buf.getvalue()).decode('utf-8')
    
    # 构建完整的base64图片URL
    img_data = f"data:image/png;base64,{img_str}"
    
    # 关闭图表，释放内存
    plt.close()
    
    return img_data

# 获取随机封面API
@app.route('/api/random_cover')
def random_cover():
    try:
        photos_dir = os.path.join(app.root_path, 'photos')
        if not os.path.exists(photos_dir):
            # 如果photos目录不存在，尝试创建
            os.makedirs(photos_dir, exist_ok=True)
            
        # 获取photos目录中的所有png和jpg图片
        image_files = glob.glob(os.path.join(photos_dir, '*.png')) + glob.glob(os.path.join(photos_dir, '*.jpg'))
        
        if not image_files:
            # 如果没有可用的图片，返回默认图片
            default_image = '/images/default-cover.png'
            return jsonify({
                'status': 'success',
                'url': default_image,
                'message': '使用默认封面图片'
            })
        
        # 随机选择一张图片
        random_image = random.choice(image_files)
        image_filename = os.path.basename(random_image)
        image_url = f'/photos/{image_filename}'
        
        return jsonify({
            'status': 'success',
            'url': image_url,
            'message': '随机封面获取成功'
        })
        
    except Exception as e:
        # 出现异常，返回默认图片
        return jsonify({
            'status': 'error',
            'url': '/images/default-cover.png',
            'message': f'获取随机封面失败: {str(e)}'
        })

# 检查数据库连接API
@app.route('/api/check_connection', methods=['GET'])
def check_connection():
    try:
        conn = get_db_connection()
        if conn:
            conn.close()
            return jsonify({
                'status': 'success',
                'message': '数据库连接正常'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': '数据库连接失败'
            }), 500
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'数据库连接检查失败: {str(e)}'
        }), 500

# 提供本地视频文件
@app.route('/video/background')
def serve_background_video():
    try:
        video_path = 'static/videos/background.mp4'
        if not os.path.exists(video_path):
            print(f"视频文件不存在: {video_path}")
            return "", 404
        return send_file(video_path, mimetype='video/mp4')
    except Exception as e:
        print(f"视频加载失败: {e}")
        return "", 404

@app.route('/video/<filename>')
def serve_video_file(filename):
    try:
        return send_from_directory('D:/PythonProject1/videos', filename)
    except Exception as e:
        print(f"视频文件服务错误: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': '视频文件不存在'
        }), 404

@app.route('/api/favorite', methods=['POST'])
def favorite_anime():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '请求数据为空'}), 400
        
        user_id = data.get('user_id')
        anime_id = data.get('anime_id')
        action = data.get('action')  # 'add' 或 'remove'
        
        if not user_id or not anime_id or not action:
            return jsonify({'success': False, 'error': '缺少必要参数'}), 400
        
        if action not in ['add', 'remove']:
            return jsonify({'success': False, 'error': '无效的操作类型'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': '数据库连接失败'}), 500
        
        cursor = conn.cursor()
        
        try:
            if action == 'add':
                # 添加收藏
                cursor.execute('''
                    INSERT INTO user_favorites (user_id, anime_id) 
                    VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP
                ''', (user_id, anime_id))
                message = '收藏成功'
            else:
                # 取消收藏
                cursor.execute('''
                    DELETE FROM user_favorites 
                    WHERE user_id = %s AND anime_id = %s
                ''', (user_id, anime_id))
                message = '取消收藏成功'
            
            conn.commit()
            return jsonify({
                'success': True,
                'message': message
            })
            
        except Exception as e:
            conn.rollback()
            print(f"数据库操作失败: {e}")
            return jsonify({'success': False, 'error': '数据库操作失败'}), 500
            
        finally:
            cursor.close()
            conn.close()
        
    except Exception as e:
        print(f"收藏操作失败: {e}")
        return jsonify({'success': False, 'error': f'操作失败: {str(e)}'}), 500

if __name__ == '__main__':
    # 初始化数据库
    init_database()
    
    # 确保封面目录存在
    if not os.path.exists(COVER_DIR):
        try:
            os.makedirs(COVER_DIR)
            print(f"创建封面目录: {COVER_DIR}")
        except Exception as e:
            print(f"创建封面目录失败: {e}")
    
    # 设置静态文件目录
    app.static_folder = 'static'
    app.static_url_path = '/static'
    
    # 确保静态文件目录存在
    if not os.path.exists(app.static_folder):
        os.makedirs(app.static_folder)
    
    # 确保photos目录存在
    photos_dir = os.path.join(app.static_folder, 'photos')
    if not os.path.exists(photos_dir):
        os.makedirs(photos_dir)
    
    # 启动服务器
    print("启动服务器...")
    print(f"静态文件目录: {app.static_folder}")
    print(f"封面目录: {COVER_DIR}")
    app.run(host='0.0.0.0', port=5001, debug=True) 