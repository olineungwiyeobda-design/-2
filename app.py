# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import uuid
import random
import string
from datetime import datetime

app = Flask(__name__)
CORS(app)  # 프론트엔드와 통신 허용

# 데이터베이스 초기화
def init_db():
    conn = sqlite3.connect('school.db')
    c = conn.cursor()
    
    # 선생님 테이블
    c.execute('''CREATE TABLE IF NOT EXISTS teachers
                 (id TEXT PRIMARY KEY, name TEXT, class_code TEXT UNIQUE, class_name TEXT)''')
    
    # 학생 테이블
    c.execute('''CREATE TABLE IF NOT EXISTS students
                 (id TEXT PRIMARY KEY, name TEXT, class_code TEXT, points INTEGER DEFAULT 0,
                  FOREIGN KEY(class_code) REFERENCES teachers(class_code))''')
    
    # 퀘스트 테이블
    c.execute('''CREATE TABLE IF NOT EXISTS quests
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, class_code TEXT, title TEXT,
                  description TEXT, reward INTEGER)''')
    
    # 퀘스트 완료 테이블
    c.execute('''CREATE TABLE IF NOT EXISTS quest_completions
                 (student_id TEXT, quest_id INTEGER, completed_at TIMESTAMP,
                  PRIMARY KEY(student_id, quest_id))''')
    
    # 마켓 아이템 테이블
    c.execute('''CREATE TABLE IF NOT EXISTS market_items
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price INTEGER, icon TEXT)''')
    
    # 구매 내역 테이블
    c.execute('''CREATE TABLE IF NOT EXISTS purchases
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, item_id INTEGER,
                  item_name TEXT, purchased_at TIMESTAMP)''')
    
    # 기본 마켓 아이템 추가
    c.execute("SELECT COUNT(*) FROM market_items")
    if c.fetchone()[0] == 0:
        items = [
            ('숙제 면제권', 100, '📝'),
            ('자리 이동권', 50, '🪑'),
            ('간식 쿠폰', 80, '🍪'),
            ('칭찬 스티커', 30, '⭐'),
            ('게임 시간권', 120, '🎮'),
            ('책 선물권', 150, '📚')
        ]
        c.executemany("INSERT INTO market_items (name, price, icon) VALUES (?, ?, ?)", items)
    
    conn.commit()
    conn.close()

init_db()

# 학급 코드 생성
def generate_class_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

# ===== API 엔드포인트 =====

# 선생님 - 학급 생성
@app.route('/api/teacher/create_class', methods=['POST'])
def create_class():
    data = request.json
    teacher_id = str(uuid.uuid4())
    class_code = generate_class_code()
    
    conn = sqlite3.connect('school.db')
    c = conn.cursor()
    
    try:
        c.execute("INSERT INTO teachers (id, name, class_code, class_name) VALUES (?, ?, ?, ?)",
                  (teacher_id, data['teacher_name'], class_code, data['class_name']))
        conn.commit()
        return jsonify({'teacher_id': teacher_id, 'class_code': class_code})
    except sqlite3.IntegrityError:
        return jsonify({'error': '이미 존재하는 학급 코드입니다'}), 400
    finally:
        conn.close()

# 학생 - 학급 참여
@app.route('/api/student/join', methods=['POST'])
def join_class():
    data = request.json
    student_id = str(uuid.uuid4())
    
    conn = sqlite3.connect('school.db')
    c = conn.cursor()
    
    # 학급 코드 확인
    c.execute("SELECT class_code FROM teachers WHERE class_code = ?", (data['class_code'],))
    if not c.fetchone():
        conn.close()
        return jsonify({'error': '존재하지 않는 학급 코드입니다'}), 404
    
    # 학생 추가
    c.execute("INSERT INTO students (id, name, class_code, points) VALUES (?, ?, ?, 0)",
              (student_id, data['name'], data['class_code']))
    conn.commit()
    
    # 학생 정보 반환
    c.execute("SELECT id, name, class_code, points FROM students WHERE id = ?", (student_id,))
    student = c.fetchone()
    conn.close()
    
    return jsonify({
        'id': student[0],
        'name': student[1],
        'class_code': student[2],
        'points': student[3],
        'role': 'student'
    })

# 학생 목록 조회
@app.route('/api/students/<class_code>', methods=['GET'])
def get_students(class_code):
    conn = sqlite3.connect('school.db')
    c = conn.cursor()
    c.execute("SELECT id, name, class_code, points FROM students WHERE class_code = ? ORDER BY points DESC",
              (class_code,))
    students = c.fetchall()
    conn.close()
    
    return jsonify([{
        'id': s[0],
        'name': s[1],
        'class_code': s[2],
        'points': s[3],
        'role': 'student'
    } for s in students])

# 포인트 조정
@app.route('/api/points/adjust', methods=['POST'])
def adjust_points():
    data = request.json
    
    conn = sqlite3.connect('school.db')
    c = conn.cursor()
    c.execute("UPDATE students SET points = points + ? WHERE id = ?",
              (data['amount'], data['student_id']))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

# 퀘스트 생성
@app.route('/api/quest/create', methods=['POST'])
def create_quest():
    data = request.json
    
    conn = sqlite3.connect('school.db')
    c = conn.cursor()
    c.execute("INSERT INTO quests (class_code, title, description, reward) VALUES (?, ?, ?, ?)",
              (data['class_code'], data['title'], data['description'], data['reward']))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

# 퀘스트 목록 조회
@app.route('/api/quests/<class_code>', methods=['GET'])
def get_quests(class_code):
    conn = sqlite3.connect('school.db')
    c = conn.cursor()
    c.execute("""
        SELECT q.id, q.title, q.description, q.reward, q.class_code,
               CASE WHEN qc.student_id IS NOT NULL THEN 1 ELSE 0 END as completed
        FROM quests q
        LEFT JOIN quest_completions qc ON q.id = qc.quest_id
        WHERE q.class_code = ?
        ORDER BY q.id DESC
    """, (class_code,))
    quests = c.fetchall()
    conn.close()
    
    return jsonify([{
        'id': q[0],
        'title': q[1],
        'description': q[2],
        'reward': q[3],
        'class_code': q[4],
        'completed': bool(q[5])
    } for q in quests])

# 퀘스트 완료
@app.route('/api/quest/complete', methods=['POST'])
def complete_quest():
    data = request.json
    
    conn = sqlite3.connect('school.db')
    c = conn.cursor()
    
    # 이미 완료했는지 확인
    c.execute("SELECT * FROM quest_completions WHERE student_id = ? AND quest_id = ?",
              (data['student_id'], data['quest_id']))
    if c.fetchone():
        conn.close()
        return jsonify({'error': '이미 완료한 퀘스트입니다'}), 400
    
    # 퀘스트 보상 확인
    c.execute("SELECT reward FROM quests WHERE id = ?", (data['quest_id'],))
    result = c.fetchone()
    if not result:
        conn.close()
        return jsonify({'error': '존재하지 않는 퀘스트입니다'}), 404
    
    reward = result[0]
    
    # 퀘스트 완료 기록
    c.execute("INSERT INTO quest_completions (student_id, quest_id, completed_at) VALUES (?, ?, ?)",
              (data['student_id'], data['quest_id'], datetime.now()))
    
    # 포인트 지급
    c.execute("UPDATE students SET points = points + ? WHERE id = ?",
              (reward, data['student_id']))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'reward': reward})

# 마켓 아이템 조회
@app.route('/api/market', methods=['GET'])
def get_market():
    conn = sqlite3.connect('school.db')
    c = conn.cursor()
    c.execute("SELECT id, name, price, icon FROM market_items")
    items = c.fetchall()
    conn.close()
    
    return jsonify([{
        'id': i[0],
        'name': i[1],
        'price': i[2],
        'icon': i[3]
    } for i in items])

# 아이템 구매
@app.route('/api/market/buy', methods=['POST'])
def buy_item():
    data = request.json
    
    conn = sqlite3.connect('school.db')
    c = conn.cursor()
    
    # 학생 포인트 확인
    c.execute("SELECT points FROM students WHERE id = ?", (data['student_id'],))
    result = c.fetchone()
    if not result:
        conn.close()
        return jsonify({'error': '학생을 찾을 수 없습니다'}), 404
    
    student_points = result[0]
    
    # 아이템 가격 확인
    c.execute("SELECT name, price FROM market_items WHERE id = ?", (data['item_id'],))
    result = c.fetchone()
    if not result:
        conn.close()
        return jsonify({'error': '아이템을 찾을 수 없습니다'}), 404
    
    item_name, item_price = result
    
    if student_points < item_price:
        conn.close()
        return jsonify({'error': '포인트가 부족합니다'}), 400
    
    # 구매 처리
    c.execute("UPDATE students SET points = points - ? WHERE id = ?",
              (item_price, data['student_id']))
    c.execute("INSERT INTO purchases (student_id, item_id, item_name, purchased_at) VALUES (?, ?, ?, ?)",
              (data['student_id'], data['item_id'], item_name, datetime.now()))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

# 구매 내역 조회
@app.route('/api/purchases/<student_id>', methods=['GET'])
def get_purchases(student_id):
    conn = sqlite3.connect('school.db')
    c = conn.cursor()
    c.execute("SELECT item_name, purchased_at FROM purchases WHERE student_id = ? ORDER BY purchased_at DESC",
              (student_id,))
    purchases = c.fetchall()
    conn.close()
    
    return jsonify([{
        'item_name': p[0],
        'purchased_at': p[1]
    } for p in purchases])

if __name__ == '__main__':
    app.run(debug=True, port=5000)
