// src/App.tsx
import React, { useState, useEffect } from 'react';
import './App.css';

// API URL (배포 후 변경)
const API_URL = 'http://localhost:5000/api';

interface User {
  id: string;
  name: string;
  role: 'teacher' | 'student';
  class_code: string;
  points: number;
}

interface Quest {
  id: number;
  title: string;
  description: string;
  reward: number;
  class_code: string;
}

interface MarketItem {
  id: number;
  name: string;
  price: number;
  icon: string;
}

interface StudentQuest extends Quest {
  completed: boolean;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loginMode, setLoginMode] = useState<'select' | 'teacher' | 'student'>('select');
  const [page, setPage] = useState<'home' | 'quest' | 'market' | 'arcade' | 'manage'>('home');

  // 로그인 폼
  const [teacherName, setTeacherName] = useState('');
  const [className, setClassName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [classCode, setClassCode] = useState('');

  // 데이터
  const [students, setStudents] = useState<User[]>([]);
  const [quests, setQuests] = useState<StudentQuest[]>([]);
  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  const [purchases, setPurchases] = useState<string[]>([]);

  // 아케이드 게임 상태
  const [gameScore, setGameScore] = useState(0);
  const [gameActive, setGameActive] = useState(false);

  // 선생님 - 학급 생성
  const handleTeacherLogin = async () => {
    try {
      const response = await fetch(`${API_URL}/teacher/create_class`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_name: teacherName, class_name: className })
      });
      const data = await response.json();
      
      setUser({
        id: data.teacher_id,
        name: teacherName,
        role: 'teacher',
        class_code: data.class_code,
        points: 0
      });
      alert(`학급 코드: ${data.class_code} (학생들에게 공유하세요!)`);
      loadStudents(data.class_code);
      loadQuests(data.class_code);
    } catch (error) {
      console.error('Error:', error);
      alert('로그인 실패');
    }
  };

  // 학생 - 학급 가입
  const handleStudentLogin = async () => {
    try {
      const response = await fetch(`${API_URL}/student/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: studentName, class_code: classCode })
      });
      const data = await response.json();
      
      if (data.error) {
        alert(data.error);
        return;
      }

      setUser(data);
      loadQuests(classCode);
      loadMarketItems();
      loadPurchases(data.id);
    } catch (error) {
      console.error('Error:', error);
      alert('로그인 실패');
    }
  };

  // 학생 목록 불러오기
  const loadStudents = async (code: string) => {
    try {
      const response = await fetch(`${API_URL}/students/${code}`);
      const data = await response.json();
      setStudents(data);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  // 퀘스트 불러오기
  const loadQuests = async (code: string) => {
    try {
      const response = await fetch(`${API_URL}/quests/${code}`);
      const data = await response.json();
      setQuests(data);
    } catch (error) {
      console.error('Error loading quests:', error);
    }
  };

  // 마켓 아이템 불러오기
  const loadMarketItems = async () => {
    try {
      const response = await fetch(`${API_URL}/market`);
      const data = await response.json();
      setMarketItems(data);
    } catch (error) {
      console.error('Error loading market:', error);
    }
  };

  // 구매 내역 불러오기
  const loadPurchases = async (studentId: string) => {
    try {
      const response = await fetch(`${API_URL}/purchases/${studentId}`);
      const data = await response.json();
      setPurchases(data.map((p: any) => p.item_name));
    } catch (error) {
      console.error('Error loading purchases:', error);
    }
  };

  // 포인트 지급/차감
  const adjustPoints = async (studentId: string, amount: number) => {
    try {
      const response = await fetch(`${API_URL}/points/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, amount })
      });
      await response.json();
      loadStudents(user!.class_code);
    } catch (error) {
      console.error('Error adjusting points:', error);
    }
  };

  // 퀘스트 생성
  const createQuest = async () => {
    const title = prompt('퀘스트 제목:');
    const description = prompt('퀘스트 설명:');
    const reward = prompt('보상 포인트:');
    
    if (!title || !description || !reward) return;

    try {
      await fetch(`${API_URL}/quest/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_code: user!.class_code,
          title,
          description,
          reward: parseInt(reward)
        })
      });
      loadQuests(user!.class_code);
    } catch (error) {
      console.error('Error creating quest:', error);
    }
  };

  // 퀘스트 완료
  const completeQuest = async (questId: number) => {
    try {
      const response = await fetch(`${API_URL}/quest/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user!.id, quest_id: questId })
      });
      const data = await response.json();
      
      if (data.error) {
        alert(data.error);
        return;
      }

      alert(`퀘스트 완료! +${data.reward} 포인트`);
      setUser({ ...user!, points: user!.points + data.reward });
      loadQuests(user!.class_code);
    } catch (error) {
      console.error('Error completing quest:', error);
    }
  };

  // 아이템 구매
  const buyItem = async (item: MarketItem) => {
    if (user!.points < item.price) {
      alert('포인트가 부족합니다!');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/market/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user!.id, item_id: item.id })
      });
      const data = await response.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      alert(`${item.name} 구매 완료!`);
      setUser({ ...user!, points: user!.points - item.price });
      setPurchases([...purchases, item.name]);
    } catch (error) {
      console.error('Error buying item:', error);
    }
  };

  // 간단한 타이핑 게임
  const startTypingGame = () => {
    setGameActive(true);
    setGameScore(0);
    
    const words = ['학급', '포인트', '퀘스트', '보상', '성장', '도전', '성취'];
    let score = 0;
    
    const playRound = () => {
      const word = words[Math.floor(Math.random() * words.length)];
      const input = prompt(`다음 단어를 입력하세요: ${word}`);
      
      if (input === word) {
        score += 10;
        setGameScore(score);
        if (score < 50) {
          playRound();
        } else {
          alert(`게임 종료! 점수: ${score}`);
          setGameActive(false);
        }
      } else {
        alert(`틀렸습니다! 최종 점수: ${score}`);
        setGameActive(false);
      }
    };
    
    playRound();
  };

  // 로그인 화면
  if (!user) {
    return (
      <div className="container">
        <h1 className="title">🎓 학급 정서 플랫폼</h1>
        
        {loginMode === 'select' && (
          <div className="login-box">
            <h2>로그인 선택</h2>
            <button onClick={() => setLoginMode('teacher')} className="btn btn-primary">
              👨‍🏫 선생님 로그인
            </button>
            <button onClick={() => setLoginMode('student')} className="btn btn-secondary">
              👨‍🎓 학생 로그인
            </button>
          </div>
        )}

        {loginMode === 'teacher' && (
          <div className="login-box">
            <h2>👨‍🏫 선생님 로그인</h2>
            <input
              type="text"
              placeholder="선생님 이름"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className="input"
            />
            <input
              type="text"
              placeholder="학급명 (예: 2024-3반)"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="input"
            />
            <button onClick={handleTeacherLogin} className="btn btn-primary">
              학급 생성
            </button>
            <button onClick={() => setLoginMode('select')} className="btn btn-text">
              뒤로가기
            </button>
          </div>
        )}

        {loginMode === 'student' && (
          <div className="login-box">
            <h2>👨‍🎓 학생 로그인</h2>
            <input
              type="text"
              placeholder="이름"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="input"
            />
            <input
              type="text"
              placeholder="학급 코드"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value.toUpperCase())}
              className="input"
            />
            <button onClick={handleStudentLogin} className="btn btn-primary">
              학급 참여
            </button>
            <button onClick={() => setLoginMode('select')} className="btn btn-text">
              뒤로가기
            </button>
          </div>
        )}
      </div>
    );
  }

  // 메인 화면
  return (
    <div className="container">
      <header className="header">
        <h1>🎓 학급 플랫폼</h1>
        <div className="user-info">
          <span>{user.name} ({user.role === 'teacher' ? '선생님' : '학생'})</span>
          {user.role === 'student' && <span className="points">⭐ {user.points}P</span>}
          <button onClick={() => setUser(null)} className="btn-icon">
            <span>🚪</span>
          </button>
        </div>
      </header>

      <nav className="nav">
        <button onClick={() => setPage('home')} className={page === 'home' ? 'active' : ''}>
          🏠 홈
        </button>
        <button onClick={() => setPage('quest')} className={page === 'quest' ? 'active' : ''}>
          🎯 퀘스트
        </button>
        <button onClick={() => setPage('market')} className={page === 'market' ? 'active' : ''}>
          🏪 마켓
        </button>
        <button onClick={() => setPage('arcade')} className={page === 'arcade' ? 'active' : ''}>
          🎮 아케이드
        </button>
        {user.role === 'teacher' && (
          <button onClick={() => setPage('manage')} className={page === 'manage' ? 'active' : ''}>
            👥 학생 관리
          </button>
        )}
      </nav>

      <main className="main">
        {/* 홈 */}
        {page === 'home' && (
          <div className="content">
            <h2>환영합니다! 👋</h2>
            {user.role === 'teacher' ? (
              <div className="info-box">
                <p>학급 코드: <strong>{user.class_code}</strong></p>
                <p>학생 수: {students.length}명</p>
              </div>
            ) : (
              <div className="info-box">
                <p>보유 포인트: <strong>{user.points}P</strong></p>
                <p>구매한 아이템: {purchases.length}개</p>
              </div>
            )}
          </div>
        )}

        {/* 퀘스트 */}
        {page === 'quest' && (
          <div className="content">
            <div className="section-header">
              <h2>🎯 퀘스트</h2>
              {user.role === 'teacher' && (
                <button onClick={createQuest} className="btn btn-small">+ 퀘스트 추가</button>
              )}
            </div>
            <div className="quest-list">
              {quests.map((quest) => (
                <div key={quest.id} className={`quest-card ${quest.completed ? 'completed' : ''}`}>
                  <h3>{quest.title}</h3>
                  <p>{quest.description}</p>
                  <div className="quest-footer">
                    <span className="reward">⭐ {quest.reward}P</span>
                    {user.role === 'student' && !quest.completed && (
                      <button onClick={() => completeQuest(quest.id)} className="btn btn-small">
                        완료하기
                      </button>
                    )}
                    {quest.completed && <span className="badge">✅ 완료</span>}
                  </div>
                </div>
              ))}
              {quests.length === 0 && <p className="empty">퀘스트가 없습니다.</p>}
            </div>
          </div>
        )}

        {/* 마켓 */}
        {page === 'market' && user.role === 'student' && (
          <div className="content">
            <h2>🏪 마켓</h2>
            <div className="market-grid">
              {marketItems.map((item) => (
                <div key={item.id} className="market-card">
                  <div className="item-icon">{item.icon}</div>
                  <h3>{item.name}</h3>
                  <p className="price">{item.price}P</p>
                  {purchases.includes(item.name) ? (
                    <span className="badge">보유중</span>
                  ) : (
                    <button onClick={() => buyItem(item)} className="btn btn-small">
                      구매하기
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 아케이드 */}
        {page === 'arcade' && user.role === 'student' && (
          <div className="content">
            <h2>🎮 아케이드</h2>
            <div className="arcade-box">
              <h3>⌨️ 타이핑 게임</h3>
              <p>단어를 빠르게 입력하세요!</p>
              <p>현재 점수: {gameScore}</p>
              <button 
                onClick={startTypingGame} 
                disabled={gameActive}
                className="btn btn-primary"
              >
                {gameActive ? '게임 진행중...' : '게임 시작'}
              </button>
            </div>
          </div>
        )}

        {/* 학생 관리 (선생님) */}
        {page === 'manage' && user.role === 'teacher' && (
          <div className="content">
            <h2>👥 학생 관리</h2>
            <div className="student-list">
              {students.map((student) => (
                <div key={student.id} className="student-card">
                  <div className="student-info">
                    <h3>{student.name}</h3>
                    <span className="points">⭐ {student.points}P</span>
                  </div>
                  <div className="student-actions">
                    <button onClick={() => adjustPoints(student.id, 10)} className="btn btn-small btn-success">
                      +10P
                    </button>
                    <button onClick={() => adjustPoints(student.id, -10)} className="btn btn-small btn-danger">
                      -10P
                    </button>
                  </div>
                </div>
              ))}
              {students.length === 0 && <p className="empty">학생이 없습니다.</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
