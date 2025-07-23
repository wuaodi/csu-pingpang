const autoSync = require('../../utils/autoSync');

Page({
  data: {
    rankings: [],
    gameHistory: [],
    totalGames: 0,
    totalPlayers: 0,
    loading: false,
    refreshing: false
  },

  onLoad() {
    // 页面首次加载时默认刷新一次
    this.loadDataFromRemote();
  },

  onShow() {
    // 每次显示页面时从本地加载，保持快速响应
    this.loadDataFromLocal();
  },

  // 从本地加载数据
  loadDataFromLocal() {
    const players = wx.getStorageSync('players') || [];
    const games = wx.getStorageSync('games') || [];
    
    this.processRankings(players);
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
      
      this.processRankings(players);
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
  processRankings(players) {
    const rankings = players
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

    this.setData({ 
      rankings,
      totalPlayers: players.length
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

    // 获取今天和上月今日的日期
    const today = new Date();
    const lastMonthToday = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    // 格式化日期用于比较 (YYYY-MM-DD)
    const formatDate = (date) => {
      return date.getFullYear() + '-' + 
             String(date.getMonth() + 1).padStart(2, '0') + '-' + 
             String(date.getDate()).padStart(2, '0');
    };
    
    const todayStr = formatDate(today);
    const lastMonthTodayStr = formatDate(lastMonthToday);
    
    // 分类游戏记录
    const recentGames = [];
    const lastMonthTodayGames = [];
    
    games.forEach(game => {
      const gameDate = new Date(game.gameTime);
      const gameDateStr = formatDate(gameDate);
      
      // 上月今日的记录
      if (gameDateStr === lastMonthTodayStr) {
        lastMonthTodayGames.push(game);
      }
      // 最近的记录（排除上月今日已经收集的）
      else if (recentGames.length < 10) {
        recentGames.push(game);
      }
    });
    
    // 合并记录：最近10条 + 上月今日
    let displayGames = [...recentGames];
    
    // 如果有上月今日的记录，添加分隔标识并加入
    if (lastMonthTodayGames.length > 0) {
      // 添加分隔符标识
      displayGames.push({
        id: 'separator-lastmonth',
        isSeparator: true,
        separatorText: '上月今日'
      });
      
      // 添加上月今日的记录
      displayGames = displayGames.concat(lastMonthTodayGames);
    }
    
    // 格式化显示数据
    const gameHistory = displayGames.map(game => {
      // 分隔符直接返回
      if (game.isSeparator) {
        return game;
      }
      
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

  // 下拉刷新
  async onPullDownRefresh() {
    this.setData({ refreshing: true });
    
    try {
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
    } finally {
      this.setData({ refreshing: false });
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
      
      exportText += '\n🎮 比赛记录 (最近10条 + 上月今日)\n';
      exportText += '时间\t选手A\t比分\t选手B\t结果\n';
      
      this.data.gameHistory.forEach(item => {
        if (item.isSeparator) {
          exportText += `\n--- ${item.separatorText} ---\n`;
        } else {
          const result = item.isDraw ? '平局' : `${item.winner}获胜`;
          exportText += `${item.formattedTime}\t${item.player1?.name}\t${item.player1?.score}:${item.player2?.score}\t${item.player2?.name}\t${result}\n`;
        }
      });
      
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