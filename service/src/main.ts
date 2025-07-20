import * as fs from "fs";
import * as path from "path";

// 工具类，提供通用功能
class Utils {
  // 生成随机ID
  static createId = () => {
    return Math.random().toString(16).slice(2).toUpperCase();
  };
}

// 成员类，表示参与计分的用户
class Member {
  id: string;      // 成员唯一标识
  name: string;    // 成员姓名
  score: number;   // 当前分数
  constructor(name: string) {
    this.id = Utils.createId();
    this.name = name;
    this.score = 0;
  }
}

// 日志类，记录分数转移历史
class Log {
  fromMemberId: string;  // 转出分数的成员ID
  toMemberId: string;    // 转入分数的成员ID
  score: number;         // 转移的分数
  constructor(fromMemberId: string, toMemberId: string, score: number) {
    this.fromMemberId = fromMemberId;
    this.toMemberId = toMemberId;
    this.score = score;
  }
}

// 内容管理类，负责房间数据的存储和检索
class Content {
  private static DATA_VERSION = "1.0.0";           // 数据版本号
  private static DATA_DIR = "data";                // 数据存储目录
  private static DAYS_TO_KEEP_DATA = 3;            // 数据保留天数

  // 内存中的内容缓存
  private static contents: Map<string, Content> = new Map();

  // 检查房间数据文件是否存在
  private static checkExists = (roomId: string) => {
    return fs.existsSync(path.join(Content.DATA_DIR, `${roomId}.json`));
  };

  // 创建唯一的房间ID
  private static createRoomId = () => {
    const maxRetries = 1000;
    for (let i = 0; i < maxRetries; i++) {
      const roomId = Utils.createId();
      if (!Content.checkExists(roomId)) return roomId;
    }
    throw new Error("无法生成唯一房间ID");
  };

  // 将内容添加到内存缓存
  private static addContent = (content: Content) => {
    Content.contents.set(content.roomId, content);
    Content.cleanUnusedData();
  };

  // 清理过期数据（内存和磁盘）
  private static cleanUnusedData = () => {
    const now = Date.now();
    const max = Content.DAYS_TO_KEEP_DATA * 24 * 60 * 60 * 1000;
    
    // 清理内存中的过期数据
    Content.contents.forEach((content) => {
      if (now - content.lastAccessTime >= max) Content.contents.delete(content.roomId);
    });

    // 清理磁盘上的过期文件
    const files = fs.readdirSync(Content.DATA_DIR);
    files.forEach((file) => {
      const filePath = path.join(Content.DATA_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        const mtime = stats.mtime.getTime();
        if (now - mtime >= max) fs.unlinkSync(filePath);
      } catch (e) {
        fs.unlinkSync(filePath);
      }
    });
  };

  // 从内存缓存获取内容
  private static getContentFromMemory = (roomId: string) => {
    const content = Content.contents.get(roomId);
    if (content) {
      content.lastAccessTime = Date.now();
      return content;
    }
  };

  // 从磁盘文件获取内容
  private static getContentFromDisk = (roomId: string) => {
    if (!Content.checkExists(roomId)) throw new Error("Room not found");
    const json = JSON.parse(fs.readFileSync(path.join(Content.DATA_DIR, `${roomId}.json`), "utf8"));
    const content = new Content({ noSave: true }).initByJson(json);
    content.lastAccessTime = Date.now();
    return content;
  };

  // 获取房间内容（优先从内存，其次从磁盘）
  public static getContent = (roomId: string) => {
    const content = Content.getContentFromMemory(roomId);
    if (content) return content;
    else return Content.getContentFromDisk(roomId);
  };

  private version: string;           // 数据版本
  private roomId: string;            // 房间ID
  private members: Member[];         // 成员列表
  private logs: Log[];               // 操作日志
  private lastAccessTime: number;    // 最后访问时间

  constructor(options: { noSave?: boolean } = {}) {
    this.version = Content.DATA_VERSION;
    this.roomId = Content.createRoomId();
    this.members = [];
    this.logs = [];
    this.lastAccessTime = Date.now();
    Content.addContent(this);
    if (!options.noSave) this.saveContent();
  }

  // 添加新成员
  public addMember = (name: string) => {
    const member = new Member(name);
    this.members.push(member);
    this.saveContent();
    return member;
  };

  // 转移分数
  public transferScore = (fromMemberId: string, toMemberId: string, score: number) => {
    if (score <= 0) throw new Error("分数必须大于0");
    if (fromMemberId === toMemberId) throw new Error("不能向自己转移分数");

    const fromMember = this.members.find((member) => member.id === fromMemberId);
    const toMember = this.members.find((member) => member.id === toMemberId);
    if (!fromMember || !toMember) throw new Error("Member not found");
    
    // 执行分数转移
    fromMember.score -= score;
    toMember.score += score;
    
    // 记录操作日志
    this.logs.push(new Log(fromMemberId, toMemberId, score));
    this.saveContent();
  };

  // 保存内容到磁盘
  private saveContent = () => {
    if (!fs.existsSync(Content.DATA_DIR)) fs.mkdirSync(Content.DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(Content.DATA_DIR, `${this.roomId}.json`), JSON.stringify(this));
  };

  // 从JSON数据初始化对象
  private initByJson = (json: any) => {
    if (json.version !== this.version) throw new Error("outdated data version");
    Object.assign(this, json);
    this.saveContent();
    return this;
  };
}
