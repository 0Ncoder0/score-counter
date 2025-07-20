import QRCode from "qrcode";

export class ScoreCounter {
  BASE_URL = "http://192.168.0.103:3000";

  constructor() {
    this.roomId = null;
    this.userId = null;
    this.userName = null;
    this.members = [];
    this.logs = [];
    this.pendingChanges = new Map(); // 存储待确认的分数变更
    this.isNameInputMode = false; // 跟踪是否在输入姓名模式

    // DOM 元素
    this.elements = {
      roomId: document.getElementById("roomId"),
      recreateRoom: document.getElementById("recreateRoom"),
      logs: document.getElementById("logs"),
      members: document.getElementById("members"),
      confirmSection: document.getElementById("confirmSection"),
      confirmChanges: document.getElementById("confirmChanges"),
      cancelChanges: document.getElementById("cancelChanges"),
      modal: document.getElementById("modal"),
      modalBody: document.getElementById("modalBody"),
      mobileTips: document.querySelector(".mobile-tips"),
    };

    this.bindEvents();
    this.initMobileFeatures();
  }

  // 初始化移动端特性
  initMobileFeatures = () => {
    // 显示移动端提示
    this.showMobileTips();

    // 添加触摸反馈
    this.addTouchFeedback();

    // 防止双击缩放
    this.preventDoubleTapZoom();
  };

  // 显示移动端提示
  showMobileTips = () => {
    if (this.elements.mobileTips) {
      setTimeout(() => {
        this.elements.mobileTips.style.display = "block";
        // 5秒后自动隐藏
        setTimeout(() => {
          this.elements.mobileTips.style.display = "none";
        }, 5000);
      }, 2000);
    }
  };

  // 添加触摸反馈
  addTouchFeedback = () => {
    const buttons = document.querySelectorAll(".btn, .member-add-btn");
    buttons.forEach((button) => {
      button.addEventListener("touchstart", (e) => {
        e.preventDefault(); // 防止默认行为
        button.style.transform = "scale(0.95)";
        this.vibrate(10);
      });

      button.addEventListener("touchend", (e) => {
        e.preventDefault(); // 防止默认行为
        button.style.transform = "";
      });
    });
  };

  // 震动反馈（如果设备支持）
  vibrate = (duration = 10) => {
    if ("vibrate" in navigator) {
      navigator.vibrate(duration);
    }
  };

  // 更新房间ID显示
  updateRoomIdDisplay = () => {
    if (this.elements.roomId) {
      this.elements.roomId.textContent = this.roomId || "-";
    }
  };

  // 检查用户是否已登录
  isUserLoggedIn = () => {
    return !!(this.userName && this.userName.trim().length > 0);
  };

  // 显示用户信息（仅用于调试）
  showUserInfo = () => {
    if (this.isUserLoggedIn()) {
      console.log(`当前用户: ${this.userName}`);
    }
  };

  // 复制房间链接
  copyRoomLink = async () => {
    if (!this.roomId) {
      this.showToast("房间ID不存在，无法复制链接", "error");
      return;
    }

    const roomUrl = `${window.location.origin}${window.location.pathname}?roomId=${this.roomId}`;

    try {
      // 尝试使用现代 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(roomUrl);
        this.showToast("房间链接已复制到剪贴板", "success");

        this.vibrate(50);
      } else {
        // 降级方案：使用传统方法
        this.fallbackCopyTextToClipboard(roomUrl);
      }
    } catch (error) {
      console.error("复制失败:", error);
      // 降级方案
      this.fallbackCopyTextToClipboard(roomUrl);
    }
  };

  // 降级复制方案
  fallbackCopyTextToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // 避免滚动到页面底部
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        this.showToast("房间链接已复制到剪贴板", "success");
        this.vibrate(50);
      } else {
        this.showToast("复制失败，请手动复制链接", "error");
        this.vibrate(100);
      }
    } catch (err) {
      console.error("复制失败:", err);
      this.showToast("复制失败，请手动复制链接", "error");
      this.vibrate(100);
    }

    document.body.removeChild(textArea);
  };

  // 显示提示消息
  showToast = (message, type = "info") => {
    // 移除现有的提示
    const existingToast = document.querySelector(".toast-message");
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement("div");
    toast.className = `toast-message toast-${type}`;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === "success" ? "rgba(40, 167, 69, 0.9)" : type === "error" ? "rgba(220, 53, 69, 0.9)" : "rgba(0, 123, 255, 0.9)"};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: toastSlideIn 0.3s ease-out;
    `;
    toast.innerHTML = message;

    document.body.appendChild(toast);

    // 3秒后自动移除
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = "toastSlideOut 0.3s ease-in";
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }
    }, 3000);
  };

  // 防止双击缩放和优化触摸响应
  preventDoubleTapZoom = () => {
    let lastTouchEnd = 0;
    let lastTouchStart = 0;

    document.addEventListener(
      "touchstart",
      (event) => {
        lastTouchStart = new Date().getTime();
      },
      { passive: false }
    );

    document.addEventListener(
      "touchend",
      (event) => {
        const now = new Date().getTime();
        const timeDiff = now - lastTouchEnd;

        // 防止双击缩放
        if (timeDiff <= 300) {
          event.preventDefault();
        }

        // 防止长按菜单
        const touchDuration = now - lastTouchStart;
        if (touchDuration > 500) {
          event.preventDefault();
        }

        lastTouchEnd = now;
      },
      { passive: false }
    );

    // 防止长按选择文本
    document.addEventListener(
      "selectstart",
      (event) => {
        event.preventDefault();
      },
      { passive: false }
    );
  };

  bindEvents = () => {
    this.elements.recreateRoom.addEventListener("touchstart", async (e) => {
      e.preventDefault();
      await this.recreateRoom();
    });
    this.elements.confirmChanges.addEventListener("touchstart", this.confirmChanges);
    this.elements.cancelChanges.addEventListener("touchstart", this.cancelChanges);

    // 点击模态框外部关闭
    this.elements.modal.addEventListener("touchstart", (e) => {
      if (e.target === this.elements.modal) {
        // 在输入姓名模式下禁止关闭
        if (this.isNameInputMode) {
          return;
        }
        this.closeModal();
      }
    });
  };

  init = async () => {
    try {
      // 1. 检查URL中是否有roomId
      const urlParams = new URLSearchParams(window.location.search);
      this.roomId = urlParams.get("roomId");

      // 如果URL中没有roomId，尝试从缓存中获取
      if (!this.roomId) {
        const cachedRoomId = localStorage.getItem("cached_roomId");
        if (cachedRoomId) {
          this.roomId = cachedRoomId;
          // 更新URL以包含缓存的roomId
          const url = new URL(window.location);
          url.searchParams.set("roomId", this.roomId);
          window.history.pushState({}, "", url);
          console.log("从缓存恢复房间ID:", this.roomId);
        } else {
          // 创建新房间
          await this.createRoom();
        }
      } else {
        // URL中有roomId，更新缓存
        localStorage.setItem("cached_roomId", this.roomId);
        this.updateRoomIdDisplay();
      }

      // 2. 检查用户信息 - 这是强制步骤
      await this.checkUser();

      // 验证用户信息是否有效
      if (!this.userName || this.userName.trim().length === 0) {
        console.error("用户昵称无效，无法继续初始化");
        return; // 阻止继续初始化
      }

      // 3. 验证房间是否存在（如果是从缓存恢复的）
      if (this.roomId && !urlParams.get("roomId")) {
        // 这是从缓存恢复的roomId，需要验证房间是否还存在
        const roomExists = await this.validateRoom();
        if (!roomExists) {
          console.log("缓存的房间不存在，清除缓存并创建新房间");
          localStorage.removeItem("cached_roomId");
          localStorage.removeItem(`user_${this.roomId}`);
          // 重新初始化
          this.roomId = null;
          this.userId = null;
          this.userName = null;
          await this.init();
          return;
        }
      }

      // 4. 显示二维码
      this.showQRCode();

      // 5. 初始化数据
      await this.loadData();

      // 6. 开始轮询更新
      this.startPolling();
    } catch (error) {
      console.error("初始化失败:", error);
      this.showToast("连接服务器失败，请检查网络连接", "error");
    }
  };

  validateRoom = async () => {
    try {
      const response = await fetch(`${this.BASE_URL}/rooms/${this.roomId}`);
      if (response.ok) {
        const result = await response.json();
        return result.success && result.data;
      }
      return false;
    } catch (error) {
      console.error("验证房间失败:", error);
      return false;
    }
  };

  createRoom = async () => {
    try {
      // 调用后端创建房间接口
      const response = await fetch(`${this.BASE_URL}/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          this.roomId = result.data.roomId;

          // 更新URL
          const url = new URL(window.location);
          url.searchParams.set("roomId", this.roomId);
          window.history.pushState({}, "", url);

          // 缓存roomId
          localStorage.setItem("cached_roomId", this.roomId);

          this.updateRoomIdDisplay();
        } else {
          const errorMsg = result.message || "创建房间失败";
          this.showToast(`${errorMsg}`, "error");
          throw new Error(errorMsg);
        }
      } else {
        this.showToast("创建房间失败，服务器无响应", "error");
        throw new Error("创建房间失败");
      }
    } catch (error) {
      console.error("创建房间失败:", error);
      this.showToast("创建房间失败，请检查网络连接", "error");
      throw error; // 重新抛出错误，不使用模拟数据
    }
  };

  checkUser = async () => {
    // 从localStorage获取用户信息
    const savedUser = localStorage.getItem(`user_${this.roomId}`);

    if (savedUser) {
      const userData = JSON.parse(savedUser);
      // 验证保存的用户名是否有效
      if (userData.userName && userData.userName.trim().length > 0) {
        this.userId = userData.userId;
        this.userName = userData.userName;
        // 显示用户信息
        this.showUserInfo();
      } else {
        // 如果保存的用户名无效，删除缓存并重新输入
        localStorage.removeItem(`user_${this.roomId}`);
        await this.showNameInput();
      }
    } else {
      // 弹出姓名输入框
      await this.showNameInput();
    }
  };

  showNameInput = async () => {
    return new Promise((resolve) => {
      this.isNameInputMode = true; // 设置为输入姓名模式
      this.elements.modalBody.innerHTML = `
        <h3>哟，来都来了，不报个名？</h3>
        <input type="text" id="nameInput" placeholder="你叫啥？（必填）" maxlength="20" autocomplete="off" required>
        <div style="margin-top: 16px; display: flex; justify-content: center;">
          <button id="confirmName" class="btn btn-primary" disabled style="min-width: 120px;">
            确认加入
          </button>
        </div>
        <div id="nameError" style="display: none; color: #dc3545; font-size: 14px; margin-top: 8px;">
          名字不能为空
        </div>
      `;

      this.elements.modal.style.display = "flex";

      const nameInput = document.getElementById("nameInput");
      const confirmName = document.getElementById("confirmName");
      const nameError = document.getElementById("nameError");

      // 移动端优化：延迟聚焦，避免键盘弹出时的布局问题
      setTimeout(() => {
        nameInput.focus();
      }, 300);

      // 实时验证输入
      const validateInput = () => {
        const name = nameInput.value.trim();
        const isValid = name.length >= 1 && name.length <= 20;

        confirmName.disabled = !isValid;

        if (name.length > 0 && !isValid) {
          nameError.style.display = "block";
          nameError.textContent = "昵称长度必须在1-20个字符之间";
        } else if (name.length === 0) {
          nameError.style.display = "none";
        } else {
          nameError.style.display = "none";
        }

        // 更新按钮样式
        if (isValid) {
          confirmName.style.opacity = "1";
          confirmName.style.cursor = "pointer";
        } else {
          confirmName.style.opacity = "0.6";
          confirmName.style.cursor = "not-allowed";
        }
      };

      const handleConfirm = async () => {
        const name = nameInput.value.trim();
        if (name && name.length >= 1 && name.length <= 20) {
          this.isNameInputMode = false; // 重置输入姓名模式
          await this.createUser(name);
          this.closeModal();
          resolve();
        } else {
          // 显示错误提示
          nameError.style.display = "block";
          nameError.textContent = "请输入有效的昵称";

          // 输入框错误样式
          nameInput.style.borderColor = "#dc3545";
          nameInput.style.boxShadow = "0 0 0 3px rgba(220,53,69,0.1)";

          // 震动反馈（如果支持）
          if (this.isMobile) {
            this.vibrate(100);
          }

          // 3秒后清除错误样式
          setTimeout(() => {
            nameInput.style.borderColor = "";
            nameInput.style.boxShadow = "";
            nameError.style.display = "none";
          }, 3000);
        }
      };

      // 绑定事件
      confirmName.addEventListener("touchstart", handleConfirm);
      nameInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleConfirm();
      });

      // 实时验证
      nameInput.addEventListener("input", () => {
        validateInput();
        // 清除错误样式
        nameInput.style.borderColor = "";
        nameInput.style.boxShadow = "";
      });

      // 初始验证
      validateInput();
    });
  };

  createUser = async (name) => {
    // 额外验证昵称
    if (!name || name.trim().length === 0) {
      this.showToast("昵称不能为空", "error");
      throw new Error("昵称不能为空");
    }

    if (name.trim().length > 20) {
      this.showToast("昵称长度不能超过20个字符", "error");
      throw new Error("昵称长度不能超过20个字符");
    }

    const trimmedName = name.trim();

    try {
      // 调用后端添加成员接口
      const response = await fetch(`${this.BASE_URL}/rooms/${this.roomId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          this.userId = result.data.id;
          this.userName = trimmedName;
        } else {
          const errorMsg = result.message || "创建用户失败";
          this.showToast(`${errorMsg}`, "error");
          throw new Error(errorMsg);
        }
      } else {
        this.showToast("创建用户失败，服务器无响应", "error");
        throw new Error("创建用户失败");
      }
    } catch (error) {
      console.error("创建用户失败:", error);
      this.showToast("创建用户失败，请重试", "error");
      throw error; // 重新抛出错误，不使用模拟数据
    }

    // 保存到localStorage
    localStorage.setItem(
      `user_${this.roomId}`,
      JSON.stringify({
        userId: this.userId,
        userName: this.userName,
      })
    );

    // 显示用户信息
    this.showUserInfo();
  };

  showQRCode = async () => {
    const roomUrl = `${window.location.origin}${window.location.pathname}?roomId=${this.roomId}`;

    try {
      // 移动端优化：根据屏幕大小调整二维码尺寸
      const qrSize = this.isMobile ? 180 : 200;
      const qrDataUrl = await QRCode.toDataURL(roomUrl, {
        width: qrSize,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      this.elements.modalBody.innerHTML = `
        <h3>房间二维码</h3>
        <p style="margin-bottom: 20px; color: #6c757d; font-size: 14px;">
          扫描二维码或点击链接复制邀请其他玩家
        </p>
        <div class="qr-code">
          <img src="${qrDataUrl}" alt="房间二维码" style="max-width: 100%; height: auto;">
        </div>
        <div style="margin-top: 20px; padding: 12px; background: #f8f9fa; border-radius: 8px; word-break: break-all;">
          <p style="margin: 0; font-size: 12px; color: #6c757d;">房间链接 (点击复制):</p>
          <a href="${roomUrl}" id="roomLink" style="color: #007bff; text-decoration: none; font-size: 14px; cursor: pointer; display: block; padding: 8px 0; border-radius: 4px; transition: background-color 0.2s;">
            ${roomUrl}
          </a>
        </div>
        <div style="margin-top: 20px; display: flex; justify-content: center;">
          <button id="closeModalBtn" class="btn btn-secondary" style="min-width: 120px;">
            关闭
          </button>
        </div>
      `;

      this.elements.modal.style.display = "flex";

      // 绑定事件
      const roomLink = document.getElementById("roomLink");
      const closeModalBtn = document.getElementById("closeModalBtn");

      if (roomLink) {
        roomLink.addEventListener("touchstart", (e) => {
          e.preventDefault(); // 阻止默认的链接跳转
          this.copyRoomLink();

          // 添加点击反馈效果
          roomLink.style.backgroundColor = "#e3f2fd";
          setTimeout(() => {
            roomLink.style.backgroundColor = "";
          }, 200);
        });

        // 添加悬停效果
        roomLink.addEventListener("mouseenter", () => {
          roomLink.style.backgroundColor = "#f8f9fa";
        });

        roomLink.addEventListener("mouseleave", () => {
          roomLink.style.backgroundColor = "";
        });
      }

      if (closeModalBtn) {
        closeModalBtn.addEventListener("touchstart", () => this.closeModal());
      }
    } catch (error) {
      console.error("生成二维码失败:", error);
    }
  };

  closeModal = () => {
    // 如果在输入姓名模式下，禁止关闭模态框
    if (this.isNameInputMode) {
      return;
    }
    this.elements.modal.style.display = "none";
  };

  recreateRoom = async () => {
    // 显示确认对话框
    return new Promise((resolve) => {
      this.elements.modalBody.innerHTML = `
        <h3>重新创建房间</h3>
        <p style="margin-bottom: 20px; color: #6c757d; font-size: 14px; line-height: 1.5;">
          重新创建房间将清空当前房间的所有数据，包括成员列表和积分记录。<br>
          此操作不可撤销，确定要继续吗？
        </p>
        <div style="margin-top: 20px; display: flex; justify-content: center; gap: 12px;">
          <button id="cancelRecreate" class="btn btn-secondary" style="min-width: 100px;">
            取消
          </button>
          <button id="confirmRecreate" class="btn btn-danger" style="min-width: 100px;">
            确认创建
          </button>
        </div>
      `;

      this.elements.modal.style.display = "flex";

      const cancelBtn = document.getElementById("cancelRecreate");
      const confirmBtn = document.getElementById("confirmRecreate");

      const handleCancel = () => {
        this.closeModal();
        resolve(false);
      };

      const handleConfirm = async () => {
        this.closeModal();
        
        // 停止当前轮询
        this.stopPolling();

        // 清空本地缓存
        localStorage.removeItem(`user_${this.roomId}`);
        localStorage.removeItem("cached_roomId");

        // 清空URL中的roomId参数
        const url = new URL(window.location);
        url.searchParams.delete("roomId");
        window.history.pushState({}, "", url);

        // 重新初始化
        this.roomId = null;
        this.userId = null;
        this.userName = null;
        this.members = [];
        this.logs = [];
        this.pendingChanges.clear();

        await this.init();
        resolve(true);
      };

      // 绑定事件
      cancelBtn.addEventListener("touchstart", handleCancel);
      confirmBtn.addEventListener("touchstart", handleConfirm);

      // 点击模态框外部关闭
      const handleModalClick = (e) => {
        if (e.target === this.elements.modal) {
          handleCancel();
        }
      };
      this.elements.modal.addEventListener("touchstart", handleModalClick);
    });
  };

  loadData = async () => {
    // 检查用户是否已登录
    if (!this.isUserLoggedIn()) {
      console.warn("用户未登录，跳过数据加载");
      return;
    }

    try {
      // 调用后端获取房间数据接口
      const response = await fetch(`${this.BASE_URL}/rooms/${this.roomId}`);

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          this.members = result.data.members || [];
          this.logs = result.data.logs || [];
        } else {
          const errorMsg = result.message || "加载数据失败";
          this.showToast(`${errorMsg}`, "error");
          throw new Error(errorMsg);
        }
      } else {
        this.showToast("加载数据失败，服务器无响应", "error");
        throw new Error("加载数据失败");
      }
    } catch (error) {
      console.error("加载数据失败:", error);
      this.showToast("加载数据失败，请检查网络连接", "error");
      throw error; // 重新抛出错误，不使用模拟数据
    }

    // 渲染界面（即使没有数据也要显示空状态）
    this.renderMembers();
    this.renderLogs();

    // 初始化时调整高度
    setTimeout(() => this.adjustLogsHeight(), 100);
  };

  renderMembers = () => {
    this.elements.members.innerHTML = "";

    // 显示所有成员
    if (this.members.length === 0) {
      this.elements.members.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 20px;">暂无成员</div>';
      return;
    }

    // 对成员进行排序，将当前用户放在最前面
    const sortedMembers = [...this.members].sort((a, b) => {
      const aIsCurrentUser = a.name === this.userName;
      const bIsCurrentUser = b.name === this.userName;

      if (aIsCurrentUser && !bIsCurrentUser) return -1;
      if (!aIsCurrentUser && bIsCurrentUser) return 1;
      return 0;
    });

    sortedMembers.forEach((member) => {
      const pendingScore = this.pendingChanges.get(member.id) || 0;
      const isCurrentUser = member.name === this.userName;

      const memberElement = document.createElement("div");
      memberElement.className = "member-item";
      memberElement.innerHTML = `
        <div class="member-name" title="${member.name}">${member.name}</div>
        <div class="member-score-section">
          <div class="member-score">${member.score}</div>
          ${pendingScore > 0 ? `<div class="member-pending">+${pendingScore}</div>` : ""}
        </div>
        ${!isCurrentUser ? `<button class="member-add-btn" data-member-id="${member.id}" title="点击加分">+</button>` : ""}
      `;

      const addBtn = memberElement.querySelector(".member-add-btn");

      if (addBtn) {
        addBtn.addEventListener("touchstart", (e) => {
          e.preventDefault();
          e.stopPropagation();

          this.addScore(member.id);
          this.renderMembers();
        });
      }

      this.elements.members.appendChild(memberElement);
    });

    this.updateConfirmSection();
  };

  renderLogs = () => {
    this.elements.logs.innerHTML = "";

    if (this.logs.length === 0) {
      this.elements.logs.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 20px;">暂无记录</div>';
      return;
    }

    this.logs.forEach((log) => {
      // 根据服务端数据结构处理日志
      const fromMember = this.members.find((m) => m.id === log.fromMemberId);
      const toMember = this.members.find((m) => m.id === log.toMemberId);

      const fromName = fromMember ? fromMember.name : "未知用户";
      const toName = toMember ? toMember.name : "未知用户";

      // 显示发起人和接收人
      const action = `给 ${toName} 加了 ${log.score} 分`;

      const logElement = document.createElement("div");
      logElement.className = "log-item";
      logElement.innerHTML = `
        <div class="log-name">${fromName}</div>
        <div class="log-details">${action}</div>
      `;

      this.elements.logs.appendChild(logElement);
    });

    setTimeout(() => this.elements.logs.scrollTo({ top: this.elements.logs.scrollHeight, behavior: "smooth" }), 1);
  };

  addScore = (memberId) => {
    const currentPending = this.pendingChanges.get(memberId) || 0;
    this.pendingChanges.set(memberId, currentPending + 1);

    // 移动端震动反馈
    this.vibrate(20);

    // 只更新确认区域，不重新渲染整个成员列表
    this.updateConfirmSection();

    // 调试信息
    console.log(`为成员 ${memberId} 加分，当前pending: ${this.pendingChanges.get(memberId)}`);
  };

  updateConfirmSection = () => {
    const hasChanges = this.pendingChanges.size > 0;
    this.elements.confirmSection.style.display = hasChanges ? "flex" : "none";

    // 调试信息
    console.log("更新确认区域，pendingChanges大小:", this.pendingChanges.size, "显示状态:", hasChanges);
  };

  // 取消修改
  cancelChanges = () => {
    // 清空待确认的变更
    this.pendingChanges.clear();

    // 隐藏确认区域
    this.updateConfirmSection();

    // 重新渲染成员列表以清除加分显示
    this.renderMembers();

    // 显示取消提示
    this.showToast("已取消所有修改", "info");

    // 移动端震动反馈
    this.vibrate(50);

    // 调试信息
    console.log("已清空pending数据，当前pendingChanges大小:", this.pendingChanges.size);
  };

  // 动态调整积分记录模块高度
  adjustLogsHeight = () => {
    const header = document.querySelector(".header");
    const members = document.querySelector(".members-container");
    const logs = document.querySelector(".logs-container");

    const gap = 12 * 3;
    const windowHeight = window.innerHeight;
    const lefted = windowHeight - header.offsetHeight - members.offsetHeight - gap;
    logs.style.height = `${lefted}px`;
  };

  confirmChanges = async () => {
    if (this.pendingChanges.size === 0) return;

    try {
      // 执行分数转移
      const transferPromises = [];

      this.pendingChanges.forEach((score, memberId) => {
        // 从发起操作的用户转移分数给目标成员
        const promise = fetch(`${this.BASE_URL}/rooms/${this.roomId}/transfer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fromMemberId: this.userId, // 发起操作的用户
            toMemberId: memberId, // 接收分数的用户
            score: score,
          }),
        });

        transferPromises.push(promise);
      });

      // 等待所有转移操作完成
      const responses = await Promise.all(transferPromises);

      // 检查是否所有操作都成功
      const allSuccess = responses.every((response) => response.ok);

      if (allSuccess) {
        // 清空待确认的变更
        this.pendingChanges.clear();

        // 重新加载数据以获取最新状态
        await this.loadData();
      } else {
        this.showToast("部分分数变更失败，请重试", "error");
        throw new Error("部分分数变更失败");
      }
    } catch (error) {
      console.error("提交分数变更失败:", error);
      this.showToast("提交分数失败，请重试", "error");
    }
  };

  startPolling = () => {
    // 检查用户是否已登录
    if (!this.isUserLoggedIn()) {
      console.warn("用户未登录，跳过轮询启动");
      return;
    }

    // 每300毫秒轮询一次数据更新
    this.pollingInterval = setInterval(async () => {
      try {
        await this.loadData();
      } catch (error) {
        console.error("轮询数据失败:", error);
        this.showToast("数据同步失败，请检查网络", "error");
        // 如果轮询失败，停止轮询
        this.stopPolling();
      }
    }, 300);
  };

  // 停止轮询
  stopPolling = () => {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  };
}
