const autoSync = require('../../utils/autoSync');

Page({
  data: {
    players: [],
    showModal: false,
    newPlayerName: '',
    loading: false,
    showStatsModal: false,
    selectedPlayer: null,
    headToHeadStats: [],
    games: []
  },

  onLoad() {
    this.loadPlayersFromLocal();
    this.loadGamesData();
  },

  onShow() {
    this.loadPlayersFromLocal();
    this.loadGamesData();
  },

  // 从本地加载选手列表
  loadPlayersFromLocal() {
    const players = wx.getStorageSync('players') || [];
    this.setData({ players: players });
  },

  // 加载比赛数据
  async loadGamesData() {
    try {
      // 先尝试从本地加载
      let games = wx.getStorageSync('games') || [];
      
      // 如果本地没有数据，尝试从远程加载
      if (games.length === 0) {
        try {
          games = await autoSync.loadGamesFromRemote();
        } catch (error) {
          console.log('远程加载比赛数据失败，使用本地数据');
        }
      }
      
      this.setData({ games: games });
    } catch (error) {
      console.error('加载比赛数据失败:', error);
    }
  },

  // 从远程加载选手列表（仅在手动刷新时调用）
  async loadPlayersFromRemote() {
    try {
      this.setData({ loading: true });
      const players = await autoSync.loadPlayersFromRemote();
      
      this.setData({ 
        players: players,
        loading: false 
      });
    } catch (error) {
      console.error('加载选手数据失败:', error);
      this.setData({ loading: false });
      
      // 如果远程加载失败，尝试使用本地数据
      this.loadPlayersFromLocal();
    }
  },

  // 显示添加选手弹窗
  showAddModal() {
    this.setData({ 
      showModal: true,
      newPlayerName: ''
    });
  },

  // 隐藏添加选手弹窗
  hideAddModal() {
    this.setData({ 
      showModal: false,
      newPlayerName: ''
    });
  },

  // 输入选手姓名
  onPlayerNameInput(e) {
    const value = e.detail.value || '';
    this.setData({
      newPlayerName: value
    });
  },

  // 添加选手（直接操作远程）
  async addPlayer() {
    const newPlayerName = (this.data.newPlayerName || '').trim();
    
    if (!newPlayerName) {
      wx.showToast({
        title: '请输入选手姓名',
        icon: 'none'
      });
      return;
    }

    try {
      this.setData({ loading: true });
      
      // 直接在远程添加选手
      await autoSync.addPlayer(newPlayerName);

    this.setData({
      showModal: false,
        newPlayerName: '',
        loading: false
    });

      // 重新从远程加载数据
      await this.loadPlayersFromRemote();

    wx.showToast({
      title: '添加成功',
      icon: 'success'
    });
    } catch (error) {
      this.setData({ loading: false });
      
      if (error.message === '选手已存在') {
        wx.showToast({
          title: '选手已存在',
          icon: 'none'
        });
      } else {
        console.error('添加选手失败:', error);
        wx.showToast({
          title: '添加失败，请重试',
          icon: 'none'
        });
      }
    }
  },



  // 手动刷新数据
  async onRefresh() {
    try {
      wx.showLoading({ title: '刷新中...' });
      
      // 重新计算选手统计
      await autoSync.recalculatePlayerStats();
      
      // 重新加载选手和比赛数据
      await Promise.all([
        this.loadPlayersFromRemote(),
        this.loadGamesData()
      ]);
      
      wx.hideLoading();
      wx.showToast({
        title: '刷新完成',
        icon: 'success'
      });
    } catch (error) {
      wx.hideLoading();
      console.error('刷新失败:', error);
      wx.showToast({
        title: '刷新失败，请重试',
        icon: 'none'
      });
    }
  },

  // 查看选手交手记录
  showPlayerStats(e) {
    const playerId = e.currentTarget.dataset.id;
    const player = this.data.players.find(p => p.id === playerId);
    
    if (!player) return;

    const headToHeadStats = this.calculateHeadToHeadStats(player.name);
    
    this.setData({
      showStatsModal: true,
      selectedPlayer: player,
      headToHeadStats: headToHeadStats
    });
  },

  // 隐藏统计弹窗
  hideStatsModal() {
    this.setData({
      showStatsModal: false,
      selectedPlayer: null,
      headToHeadStats: []
    });
  },

  // 计算交手记录统计
  calculateHeadToHeadStats(playerName) {
    const { games, players } = this.data;
    const stats = [];

    // 获取所有其他选手
    const otherPlayers = players.filter(p => p.name !== playerName);

    otherPlayers.forEach(opponent => {
      // 找出与该对手的所有比赛
      const matchesAgainstOpponent = games.filter(game => 
        (game.player1.name === playerName && game.player2.name === opponent.name) ||
        (game.player1.name === opponent.name && game.player2.name === playerName)
      );

      if (matchesAgainstOpponent.length > 0) {
        // 计算胜负记录
        const wins = matchesAgainstOpponent.filter(game => game.winner === playerName).length;
        const losses = matchesAgainstOpponent.length - wins;
        const winRate = (wins / matchesAgainstOpponent.length * 100).toFixed(1);

        stats.push({
          opponent: opponent.name,
          wins: wins,
          losses: losses,
          total: matchesAgainstOpponent.length,
          winRate: parseFloat(winRate)
        });
      } else {
        // 未交手
        stats.push({
          opponent: opponent.name,
          wins: 0,
          losses: 0,
          total: 0,
          winRate: 0
        });
      }
    });

    // 按胜率排序（高到低）
    return stats.sort((a, b) => b.winRate - a.winRate);
  }
}); 