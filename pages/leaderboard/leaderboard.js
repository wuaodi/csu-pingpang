const autoSync = require('../../utils/autoSync');

Page({
  data: {
    rankings: [],
    gameHistory: [],
    totalGames: 0,
    totalPlayers: 0,
    loading: false,
    rankingType: 'total', // 'total' 或 'daily'
    selectedDate: '', // 选中的日期 YYYY-MM-DD
    allPlayers: [], // 所有选手数据
    allGames: [] // 所有比赛数据
  },

  onLoad() {
    // 页面首次加载时默认刷新一次
    this.loadDataFromRemote();
  },

  // 初始化选中日期（在数据加载完成后）
  initializeSelectedDate(games) {
    if (games && games.length > 0) {
      // 找到最近的比赛日期
      const latestGame = games[0]; // games已经按时间排序
      if (latestGame && latestGame.gameTime) {
        const gameDate = new Date(latestGame.gameTime);
        const dateStr = gameDate.getFullYear() + '-' + 
                       String(gameDate.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(gameDate.getDate()).padStart(2, '0');
        this.setData({ selectedDate: dateStr });
        return;
      }
    }
    
    // 如果没有比赛数据，默认为今天
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + 
                     String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(today.getDate()).padStart(2, '0');
    this.setData({ selectedDate: todayStr });
  },

  onShow() {
    // 每次显示页面时从本地加载，保持快速响应
    this.loadDataFromLocal();
  },

  // 从本地加载数据
  loadDataFromLocal() {
    const players = wx.getStorageSync('players') || [];
    const games = wx.getStorageSync('games') || [];
    
    // 如果还没有选中日期，初始化日期
    if (!this.data.selectedDate) {
      this.initializeSelectedDate(games);
    }
    
    // 保存数据供切换榜单类型使用
    this.setData({
      allPlayers: players,
      allGames: games
    });
    
    this.processRankings(players, games);
    this.processGameHistory(games);
  },

  // 从远程加载页面数据（仅在手动刷新时调用）
  async loadDataFromRemote() {
    try {
      this.setData({ loading: true });
      
      // 同时从远程获取选手和比赛数据
      const [players, games] = await Promise.all([
        autoSync.loadPlayersFromRemote(),
        autoSync.loadGamesFromRemote()
      ]);
      
      // 如果还没有选中日期，初始化日期
      if (!this.data.selectedDate) {
        this.initializeSelectedDate(games);
      }
      
      // 保存数据供切换榜单类型使用
      this.setData({
        allPlayers: players,
        allGames: games
      });
      
      this.processRankings(players, games);
      this.processGameHistory(games);
      
      this.setData({ loading: false });
    } catch (error) {
      console.error('从远程加载数据失败:', error);
      this.setData({ loading: false });
      
      // 如果远程加载失败，使用本地数据作为备份
      this.loadDataFromLocal();
    }
  },

  // 处理排行榜数据
  processRankings(players, games) {
    let rankings;
    
    if (this.data.rankingType === 'daily') {
      // 日榜单：只统计选定日期的比赛
      rankings = this.calculateDailyRankings(players, games, this.data.selectedDate);
    } else {
      // 总榜单：使用选手的总体统计
      rankings = players
        .filter(player => (player.totalGames || 0) > 0)
        .map(player => {
          const totalGames = player.totalGames || 0;
          const wins = player.wins || 0;
          const losses = player.losses || 0;
          const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
          
          return {
            id: player.id,
            name: player.name,
            totalGames,
            wins,
            losses,
            winRate
          };
        })
        .sort((a, b) => {
          if (b.winRate !== a.winRate) return b.winRate - a.winRate;
          if (b.totalGames !== a.totalGames) return b.totalGames - a.totalGames;
          return b.wins - a.wins;
        });
    }

    this.setData({ 
      rankings,
      totalPlayers: players.length
    });
  },

  // 计算日榜单
  calculateDailyRankings(players, games, targetDate) {
    // 筛选目标日期的比赛
    const dailyGames = games.filter(game => {
      if (!game.gameTime) return false;
      
      const gameDate = new Date(game.gameTime);
      const gameDateStr = gameDate.getFullYear() + '-' + 
                          String(gameDate.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(gameDate.getDate()).padStart(2, '0');
      
      return gameDateStr === targetDate;
    });

    // 统计每个选手在该日期的战绩
    const dailyStats = {};
    
    dailyGames.forEach(game => {
      const player1 = game.player1;
      const player2 = game.player2;
      
      // 检查选手数据是否有效
      if (!player1 || !player2 || !player1.name || !player2.name) {
        return;
      }
      
      // 根据选手姓名查找选手ID
      const player1Info = players.find(p => p.name === player1.name);
      const player2Info = players.find(p => p.name === player2.name);
      
      if (!player1Info || !player2Info) {
        return;
      }
      
      // 初始化选手统计（使用选手姓名作为键）
      if (!dailyStats[player1.name]) {
        dailyStats[player1.name] = {
          id: player1Info.id,
          name: player1.name,
          wins: 0,
          losses: 0,
          totalGames: 0
        };
      }
      if (!dailyStats[player2.name]) {
        dailyStats[player2.name] = {
          id: player2Info.id,
          name: player2.name,
          wins: 0,
          losses: 0,
          totalGames: 0
        };
      }
      
      // 更新统计
      dailyStats[player1.name].totalGames++;
      dailyStats[player2.name].totalGames++;
      
      const score1 = parseInt(player1.score) || 0;
      const score2 = parseInt(player2.score) || 0;
      
      if (score1 > score2) {
        dailyStats[player1.name].wins++;
        dailyStats[player2.name].losses++;
      } else if (score2 > score1) {
        dailyStats[player2.name].wins++;
        dailyStats[player1.name].losses++;
      }
      // 平局不计入胜负
    });

    // 转换为排行榜格式并排序
    return Object.values(dailyStats)
      .filter(player => player.totalGames > 0)
      .map(player => {
        const winRate = player.totalGames > 0 ? Math.round((player.wins / player.totalGames) * 100) : 0;
        return {
          ...player,
          winRate
        };
      })
      .sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.totalGames !== a.totalGames) return b.totalGames - a.totalGames;
        return b.wins - a.wins;
      });
  },

  // 处理比赛历史数据
  processGameHistory(games) {
    if (games.length === 0) {
      this.setData({ 
        gameHistory: [],
        totalGames: 0
      });
      return;
    }

    let filteredGames;
    
    if (this.data.rankingType === 'daily' && this.data.selectedDate) {
      // 日榜单模式：只显示选定日期的比赛记录，没有则为空
      filteredGames = games.filter(game => {
        if (!game.gameTime) return false;
        
        const gameDate = new Date(game.gameTime);
        const gameDateStr = gameDate.getFullYear() + '-' + 
                            String(gameDate.getMonth() + 1).padStart(2, '0') + '-' + 
                            String(gameDate.getDate()).padStart(2, '0');
        
        return gameDateStr === this.data.selectedDate;
      });
    } else {
      // 总榜单模式：显示今天的比赛记录
      const today = new Date();
      const todayStr = today.getFullYear() + '-' + 
                      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(today.getDate()).padStart(2, '0');
      
      filteredGames = games.filter(game => {
        if (!game.gameTime) return false;
        
        const gameDate = new Date(game.gameTime);
        const gameDateStr = gameDate.getFullYear() + '-' + 
                            String(gameDate.getMonth() + 1).padStart(2, '0') + '-' + 
                            String(gameDate.getDate()).padStart(2, '0');
        
        return gameDateStr === todayStr;
      });
      
      // 只有在总榜单模式下，如果今天没有数据才显示最近10条
      if (filteredGames.length === 0) {
        filteredGames = games.slice(0, 10);
      }
    }
    
    // 格式化显示数据
    const gameHistory = filteredGames.map(game => {
      const gameTime = new Date(game.gameTime);
      const formattedTime = `${gameTime.getMonth() + 1}/${gameTime.getDate()} ${gameTime.getHours()}:${gameTime.getMinutes().toString().padStart(2, '0')}`;
      
      const player1Score = game.player1?.score || 0;
      const player2Score = game.player2?.score || 0;
      const isDraw = player1Score === player2Score;
      const winner = isDraw ? null : (player1Score > player2Score ? game.player1?.name : game.player2?.name);
      
      return {
        id: game.id,
        player1: game.player1,
        player2: game.player2,
        winner,
        isDraw,
        formattedTime
      };
    });

    this.setData({ 
      gameHistory,
      totalGames: games.length
    });
  },



  // 手动刷新
  async manualRefresh() {
    try {
      this.setData({ loading: true });
      
      // 重新计算选手统计
      await autoSync.recalculatePlayerStats();
      // 重新加载数据
      await this.loadDataFromRemote();
      
      wx.showToast({
        title: '刷新完成',
        icon: 'success',
        duration: 1500
      });
    } catch (error) {
      console.error('刷新失败:', error);
      wx.showToast({
        title: '刷新失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 切换榜单类型
  switchRankingType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ rankingType: type });
    
    // 重新处理排行榜数据和比赛记录
    this.processRankings(this.data.allPlayers, this.data.allGames);
    this.processGameHistory(this.data.allGames);
  },

  // 日期选择器变化
  onDateChange(e) {
    const selectedDate = e.detail.value;
    this.setData({ selectedDate });
    
    // 如果当前是日榜单模式，重新处理排行榜数据和比赛记录
    if (this.data.rankingType === 'daily') {
      this.processRankings(this.data.allPlayers, this.data.allGames);
      this.processGameHistory(this.data.allGames);
    }
  },

  // 导出数据
  async exportData() {
    try {
      wx.showLoading({ title: '导出中...' });
      
      // 从远程获取最新数据
      const [players, games] = await Promise.all([
        autoSync.loadPlayersFromRemote(),
        autoSync.loadGamesFromRemote()
      ]);
      
      let exportText = '🏓 乒乓球比赛数据\n';
      exportText += `导出时间：${new Date().toLocaleString()}\n`;
      exportText += `数据来源：远程服务器\n\n`;
      
      exportText += '📊 选手统计\n';
      exportText += '排名\t姓名\t比赛\t胜\t负\t胜率\n';
      this.data.rankings.forEach((player, index) => {
        exportText += `${index + 1}\t${player.name}\t${player.totalGames}\t${player.wins}\t${player.losses}\t${player.winRate}%\n`;
      });
      
      // 根据当前显示模式确定比赛记录的描述
      let recordDescription;
      if (this.data.rankingType === 'daily') {
        recordDescription = `🎮 比赛记录 (${this.data.selectedDate})`;
      } else {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        recordDescription = `🎮 比赛记录 (今日 ${todayStr})`;
      }
      
      exportText += `\n${recordDescription}\n`;
      
      if (this.data.gameHistory.length > 0) {
        exportText += '时间\t选手A\t比分\t选手B\t结果\n';
        
        this.data.gameHistory.forEach(item => {
          const result = item.isDraw ? '平局' : `${item.winner}获胜`;
          exportText += `${item.formattedTime}\t${item.player1?.name}\t${item.player1?.score}:${item.player2?.score}\t${item.player2?.name}\t${result}\n`;
        });
      } else {
        exportText += '该日期暂无比赛记录\n';
      }
      
      wx.hideLoading();
      
      wx.setClipboardData({
        data: exportText,
        success: () => {
          wx.showToast({
            title: '数据已复制到剪贴板',
            icon: 'success'
          });
        }
      });
    } catch (error) {
      wx.hideLoading();
      console.error('导出失败:', error);
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      });
    }
  }
}); 