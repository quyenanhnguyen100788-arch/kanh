/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  Settings, 
  Trash2, 
  Share2, 
  LogOut, 
  Moon,
  User,
  CheckCircle2, 
  Zap, 
  BookOpen, 
  Sparkles,
  ChevronRight,
  Sun,
  Download,
  FileText,
  X,
  ExternalLink,
  MoreHorizontal,
  Database,
  Lightbulb,
  Cpu,
  Key,
  Info,
  Check,
  Printer,
  Image as ImageIcon,
  FileUp,
  ScanText,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import mammoth from 'mammoth';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Attachment {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'pdf' | 'docx' | 'other';
  base64?: string;
  textContent?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
}

const INITIAL_MESSAGE = "Chào em! Cô là Lê Thị Kiều Anh: Thạc sĩ / Giáo viên bộ môn Hoá Học. Cô rất vui được đồng hành cùng em học tập. Hôm nay em cần cô hỗ trợ gì không?";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: INITIAL_MESSAGE,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      return (savedTheme as 'light' | 'dark') || 'light';
    }
    return 'light';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  
  // Settings state
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [customApiKey, setCustomApiKey] = useState('');
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('userName') || '';
  });

  const handleLogin = (name: string) => {
    if (name.trim()) {
      setUserName(name.trim());
      setIsLoggedIn(true);
      localStorage.setItem('userName', name.trim());
      localStorage.setItem('isLoggedIn', 'true');
      
      // Welcome alert
      alert(`Chào mừng em : ${name.trim()} đến với phòng học !`);
      
      // Update the initial message if it was the default one
      setMessages(prev => {
        if (prev.length === 1 && prev[0].id === '1' && prev[0].role === 'assistant') {
          return [{
            ...prev[0],
            content: `Chào ${name.trim()}! Cô là Lê Thị Kiều Anh: Thạc sĩ / Giáo viên bộ môn Hoá Học. Cô rất vui được đồng hành cùng em học tập. Hôm nay em cần cô hỗ trợ gì không?`
          }];
        }
        return prev;
      });
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setIsLoggedIn(false);
    setUserName('');
    setShowLogoutConfirm(false);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userName');
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: INITIAL_MESSAGE,
        timestamp: new Date()
      }
    ]);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  
  useEffect(() => {
    // Add transition styling to document root
    document.documentElement.style.transition = 'background-color 0.5s ease-in-out';
    document.body.style.transition = 'background-color 0.5s ease-in-out';
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1]);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFiles(true);
    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = Math.random().toString(36).substring(7);
      let attachmentType: Attachment['type'] = 'other';
      let preview = undefined;
      let textContent = undefined;

      if (file.type.startsWith('image/')) {
        attachmentType = 'image';
        preview = URL.createObjectURL(file);
      } else if (file.type === 'application/pdf') {
        attachmentType = 'pdf';
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        attachmentType = 'docx';
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          textContent = result.value;
        } catch (err) {
          console.error("Error extracting docx text:", err);
        }
      }

      const base64 = await fileToBase64(file);

      newAttachments.push({
        id,
        file,
        type: attachmentType,
        preview,
        base64,
        textContent
      });
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    setIsProcessingFiles(false);
    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const filtered = prev.filter(a => a.id !== id);
      const removed = prev.find(a => a.id === id);
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return filtered;
    });
  };

  const handleSend = async (textOverride?: string, isScanRequest = false) => {
    const textToSend = textOverride || inputValue;
    if ((!textToSend.trim() && attachments.length === 0) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend || (isScanRequest ? "Em muốn quét và ghi nhận thông tin từ các tài liệu này." : ""),
      timestamp: new Date(),
      attachments: [...attachments]
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    const currentAttachments = [...attachments];
    setAttachments([]);
    setIsLoading(true);

    try {
      const apiKey = customApiKey.trim() || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Chưa có API Key!");
      
      const ai = new GoogleGenAI({ apiKey });
      
      // Prepare history
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      // Prepare current message parts
      const parts: any[] = [];
      
      // Add text content
      let fullPrompt = textToSend;
      if (isScanRequest) {
        fullPrompt = "Hãy OCR (quét văn bản) và ghi nhận nội dung từ các hình ảnh/tài liệu đính kèm này. Sau đó chuyển đổi chúng thành các yêu cầu học tập hoặc tóm tắt nội dung chính xác. " + (textToSend ? `\nYêu cầu bổ sung: ${textToSend}` : "");
      }
      
      if (fullPrompt) {
        parts.push({ text: fullPrompt });
      }

      // Add file parts
      for (const att of currentAttachments) {
        if (att.type === 'docx' && att.textContent) {
          parts.push({ text: `[Nội dung từ tệp Word ${att.file.name}]:\n${att.textContent}` });
        } else if (att.base64) {
          parts.push({
            inlineData: {
              data: att.base64,
              mimeType: att.file.type || (att.type === 'pdf' ? 'application/pdf' : 'image/jpeg')
            }
          });
        }
      }

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: [
          ...history,
          {
            role: "user",
            parts: parts.length > 0 ? parts : [{ text: "..." }]
          }
        ],
        config: {
          systemInstruction: "Bạn đóng vai là cô Lê Thị Kiều Anh, Thạc sĩ / Giáo viên bộ môn Hoá Học. Phong cách: Nhiệt tình, gần gũi, gợi mở tư duy. Hỗ trợ học sinh học tập bộ môn Hoá học và các vấn đề giáo dục khác. Trả lời một cách thân thiện, xưng cô gọi em. Trả lời ngắn gọn, súc tích và tập trung vào yêu cầu của em. Nếu có hình ảnh hoặc tài liệu, hãy phân tích kỹ nội dung để hỗ trợ em tốt nhất."
        }
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || "Cô xin lỗi, có chút gián đoạn. Em có thể hỏi lại được không?",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Có một lỗi xảy ra khi kết nối với máy chủ. Em kiểm tra lại nhé!",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestion = (text: string) => {
    handleSend(text);
  };

  const handleClearChat = () => {
    setShowClearConfirm(true);
  };

  const confirmClearChat = () => {
    setMessages([
      {
        id: `reset-${Date.now()}`,
        role: 'assistant',
        content: INITIAL_MESSAGE,
        timestamp: new Date()
      }
    ]);
    setShowClearConfirm(false);
    // Force a scroll to top after clearing
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  };

  const handleClearApiKey = () => {
    if (confirm("Em có chắc muốn xóa API Key đã lưu không?")) {
      setCustomApiKey('');
      alert("Đã xóa API Key thành công!");
    }
  };

  const handleExportPDF = async () => {
    if (!chatContainerRef.current) return;
    
    setExportProgress("Đang chuẩn bị nội dung PDF...");
    setIsLoading(true);
    try {
      // Capture the element
      const element = chatContainerRef.current;
      
      // Temporary style to ensure full content is captured
      const originalStyle = element.style.height;
      element.style.height = 'auto';

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: theme === 'dark' ? '#151921' : '#ffffff',
        logging: false,
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });
      
      // Restore original style
      element.style.height = originalStyle;
      
      setExportProgress("Đang tạo tệp PDF...");
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const pageHeight = pdf.internal.pageSize.getHeight();
      let heightLeft = pdfHeight;
      let position = 0;

      // Add the first page
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      // Add subsequent pages if needed
      while (heightLeft > 0) {
        setExportProgress(`Đang thêm trang... (${Math.ceil(pdfHeight/pageHeight) - Math.floor(heightLeft/pageHeight)}/ ${Math.ceil(pdfHeight/pageHeight)})`);
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`TRỢ_LÝ_GIÁO_DỤC_${Date.now()}.pdf`);
      setShowExportModal(false);
    } catch (error) {
      console.error("Export Error:", error);
      alert("Có lỗi khi xuất PDF. Em thử lại nhé!");
    } finally {
      setIsLoading(false);
      setExportProgress(null);
    }
  };

  const handleExportDoc = () => {
    setExportProgress("Đang tạo tệp Word...");
    try {
      const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>TRỢ LÝ GIÁO DỤC</title>
      <style>
        body { font-family: 'Times New Roman', serif; margin: 1in; }
        .header { text-align: center; margin-bottom: 30px; }
        .title { font-size: 24pt; font-weight: bold; color: #5e66d1; }
        .date { font-size: 10pt; color: #666; margin-top: 5px; }
        .message { margin-bottom: 25px; padding: 15px; border-bottom: 1px solid #ddd; }
        .role { font-weight: bold; color: #5e66d1; font-size: 13pt; margin-bottom: 8px; }
        .content { font-size: 11pt; line-height: 1.5; text-align: justify; }
        .footer { font-size: 9pt; color: #999; text-align: center; margin-top: 50px; border-top: 1px solid #eee; padding-top: 10px; }
      </style>
      </head><body>`;
      
      let content = `<div class='header'>
        <div class='title'>NỘI DUNG HỌC TẬP CÙNG CÔ LÊ THỊ KIỀU ANH</div>
        <div class='date'>Xuất ngày: ${new Date().toLocaleString('vi-VN')}</div>
      </div>`;
      
      messages.forEach(msg => {
        const roleName = msg.role === 'user' ? `Em: ${userName}` : 'Cô: Lê Thị Kiều Anh (Thạc sĩ Hoá học)';
        const msgContent = msg.content
          .replace(/\n\n/g, "<p></p>")
          .replace(/\n/g, "<br/>")
          .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
          .replace(/\*(.*?)\*/g, "<i>$1</i>");

        content += `<div class='message'>
          <div class='role'>${roleName}</div>
          <div class='content'>${msgContent}</div>
        </div>`;
      });
      
      content += `<div class='footer'>© 2026 TRỢ LÝ GIÁO DỤC - CÔ LÊ THỊ KIỀU ANH</div>`;
      
      const sourceHTML = header + content + "</body></html>";
      const blob = new Blob(['\ufeff', sourceHTML], {
        type: 'application/msword'
      });
      
      const url = URL.createObjectURL(blob);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = url;
      fileDownload.download = `TRỢ_LÝ_GIÁO_DỤC_${Date.now()}.doc`;
      fileDownload.click();
      document.body.removeChild(fileDownload);
      URL.revokeObjectURL(url);
      
      setShowExportModal(false);
    } catch (error) {
      console.error("Doc Export Error:", error);
      alert("Có lỗi khi xuất Word. Em thử lại nhé!");
    } finally {
      setExportProgress(null);
    }
  };

  const handleShareClick = () => {
    setShowExportModal(true);
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert("Đã sao chép liên kết ứng dụng vào khay nhớ tạm!");
  };

  const handleSettings = () => {
    setShowSettings(true);
  };

  const handleNextLesson = () => {
    alert("Tính năng chuyển bài học tiếp theo đang được cập nhật!");
  };

  const [avatarUrl, setAvatarUrl] = useState<string | null>('https://images.unsplash.com/photo-1544717297-fa95b3ee51f3?w=400&h=400&fit=crop&q=80');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className={`flex h-screen w-full bg-[#f4f7fe] dark:bg-[#0a0c10] font-sans items-center justify-center p-6 ${theme === 'dark' ? 'dark text-slate-100' : 'text-slate-800'}`}>
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-[#151921] rounded-[48px] px-8 py-10 flex flex-col items-center shadow-2xl border border-white/50 dark:border-white/5 w-full max-w-[400px] relative overflow-hidden"
        >
          {/* Decorative shapes */}
          <div className="absolute top-[-40px] right-[-40px] w-64 h-64 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-[-40px] left-[-40px] w-64 h-64 bg-blue-50/50 dark:bg-blue-900/10 rounded-full blur-3xl -z-10" />

          <div className="w-20 h-20 rounded-[28px] bg-indigo-600 flex items-center justify-center text-white mb-6 shadow-xl shadow-indigo-200 dark:shadow-none">
            <Sparkles className="w-10 h-10" />
          </div>

          <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Chào em!</h2>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-8 font-medium leading-relaxed text-sm">
            Cô là Lê Thị Kiều Anh. Nhập tên của em để cô trò mình cùng bắt đầu buổi học nhé.
          </p>

          <div className="w-full space-y-5">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Tên của em là gì?" 
                value={userName}
                onChange={(e) => {
                  const val = e.target.value;
                  const capitalized = val.split(' ').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ');
                  setUserName(capitalized);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin(userName)}
                className="w-full bg-[#f8f9fc] dark:bg-[#1a1f28] border-2 border-slate-100 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-400 rounded-3xl py-4 px-6 outline-none transition-all text-base font-bold text-slate-700 dark:text-white placeholder:text-slate-400 text-center"
              />
            </div>
            
            <button 
              onClick={() => handleLogin(userName)}
              disabled={!userName.trim()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-[28px] font-black text-base transition-all active:scale-95 shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-3"
            >
              VÀO PHÒNG HỌC
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <p className="mt-8 text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em]">
            Học tập mỗi ngày • Tương lai tươi sáng
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-full bg-[#f4f7fe] dark:bg-[#0a0c10] font-sans transition-all duration-700 ease-in-out overflow-hidden ${theme === 'dark' ? 'dark text-slate-100' : 'text-slate-800'}`}>
      {/* Sidebar */}
      <motion.aside 
        key={`sidebar-${theme}`}
        initial={{ opacity: 0.9 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-[320px] p-6 flex flex-col gap-6 h-full shrink-0"
      >
        <div id="profile-card" className="bg-white dark:bg-[#151921] rounded-[40px] p-8 flex flex-col items-center shadow-lg border border-white/50 dark:border-white/5 relative flex-1 overflow-hidden transition-colors">
          {/* Decorative shapes */}
          <div className="absolute top-[-20px] left-[-20px] w-40 h-40 bg-blue-50/50 dark:bg-blue-900/10 rounded-full blur-3xl -z-10" />
          
          <div className="relative mb-6">
            <button 
              onClick={handleAvatarClick}
              className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden bg-indigo-600 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity group relative"
            >
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt="" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-16 h-16 text-white" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-white text-[10px] font-bold uppercase text-center px-2">Thay đổi ảnh</span>
              </div>
            </button>
            <input 
              type="file" 
              ref={avatarInputRef} 
              onChange={handleAvatarChange} 
              className="hidden" 
              accept="image/*"
            />
            <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 border-4 border-white dark:border-slate-800 rounded-full"></div>
          </div>

          <h2 className="text-2xl font-bold text-[#2d3748] dark:text-slate-100 mb-1 transition-colors">Lê Thị Kiều Anh</h2>
          <div className="flex items-center gap-1 mb-4">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Đang online</span>
          </div>

          <p className="text-[#5e66d1] dark:text-[#7f88f5] font-medium text-center mb-8 px-2 leading-relaxed">
            Thạc sĩ / Giáo viên bộ môn Hoá Học
          </p>

          <div className="w-full space-y-6 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-[#5e66d1] shrink-0 translate-y-0.5" />
              <p>Giáo viên môn Hoá Học</p>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#5e66d1] shrink-0 translate-y-0.5" />
              <p>Phong cách: Nhiệt tình, gần gũi, gợi mở tư duy.</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#5e66d1] shrink-0 translate-y-0.5" />
              <p>Hỗ trợ 24/7 giải đáp mọi thắc mắc.</p>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <motion.main 
        key={theme}
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex-1 flex flex-col p-6 pl-0 pb-3 gap-4"
      >
        {/* Header */}
        <header className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200 uppercase">
              {userName.trim().split(/\s+/).filter(Boolean).map((n, i, arr) => (i === 0 || (arr.length > 1 && i === arr.length - 1)) ? n[0] : '').join('').toUpperCase() || 'QA'}
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{userName}</h1>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all hover:shadow-md"
              title={theme === 'light' ? "Chuyển sang chế độ tối" : "Chuyển sang chế độ sáng"}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button 
              onClick={handleSettings}
              className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all hover:shadow-md"
              title="Cài đặt hệ thống"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={handleClearChat}
              className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-red-500 transition-all hover:shadow-md"
              title="Xoá cuộc trò chuyện"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button 
              onClick={handleShareClick}
              className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all hover:shadow-md"
              title="Xuất PDF TRỢ LÝ GIÁO DỤC"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button 
              onClick={handleLogout}
              className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 flex items-center justify-center text-red-500 hover:bg-red-100 transition-all hover:shadow-md"
              title="Đăng xuất khỏi phòng học"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 bg-white/40 dark:bg-slate-900/40 rounded-[40px] flex flex-col overflow-hidden backdrop-blur-sm border border-white/50 dark:border-white/5 relative shadow-sm">
          <div 
            ref={scrollRef}
            id="chat-container"
            className="flex-1 p-8 overflow-y-auto space-y-6 scrollbar-hide"
          >
            <div ref={chatContainerRef} className="space-y-6">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex-shrink-0 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase shadow-sm">
                          KA
                        </div>
                      )}
                      <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 justify-end mb-1">
                            {msg.attachments.map(att => (
                              <div key={att.id} className="relative group">
                                {att.type === 'image' ? (
                                  <img src={att.preview} className="w-24 h-24 object-cover rounded-xl border-2 border-white dark:border-slate-800 shadow-sm" />
                                ) : (
                                  <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-xl flex flex-col items-center justify-center p-2 text-center border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                                    <FileText className="w-6 h-6 text-indigo-500 mb-1" />
                                    <span className="text-[9px] font-bold text-slate-500 truncate w-full">{att.file.name}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <div 
                          className={`px-6 py-4 rounded-[24px] text-sm leading-relaxed shadow-sm markdown-content ${
                            msg.role === 'user' 
                              ? 'bg-indigo-600 text-white rounded-tr-none' 
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-700'
                          }`}
                        >
                          <ReactMarkdown 
                            remarkPlugins={[remarkMath]} 
                            rehypePlugins={[rehypeKatex]}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs shadow-sm">
                        KA
                      </div>
                      <div className="px-6 py-4 rounded-[24px] rounded-tl-none bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700 flex gap-1">
                        <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }}>.</motion.span>
                        <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}>.</motion.span>
                        <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}>.</motion.span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer UI: Suggestions + Input */}
          <div className="px-8 pb-4 space-y-4">
            {/* Attachment Preview Area */}
            <AnimatePresence>
              {attachments.length > 0 && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex gap-3 pb-2 overflow-x-auto scrollbar-hide"
                >
                  {attachments.map(att => (
                    <motion.div 
                      key={att.id}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="relative group shrink-0"
                    >
                      {att.type === 'image' ? (
                        <img src={att.preview} className="w-16 h-16 object-cover rounded-2xl border-2 border-indigo-100 dark:border-indigo-900 shadow-sm" />
                      ) : (
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/40 rounded-2xl flex flex-col items-center justify-center p-2 text-center border-2 border-indigo-100 shadow-sm">
                          <FileText className="w-5 h-5 text-indigo-600 mb-1" />
                          <span className="text-[8px] font-bold text-indigo-700 truncate w-full">{att.file.name}</span>
                        </div>
                      )}
                      <button 
                        onClick={() => removeAttachment(att.id)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-white dark:bg-slate-800 rounded-full border border-slate-100 dark:border-slate-700 flex items-center justify-center text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Suggestions */}
            <div className="flex items-center justify-center gap-2">
              <button 
                onClick={() => handleSuggestion("Gợi ý nhẹ nhàng cho em một số cách học tốt môn Hoá.")}
                className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Gợi ý nhẹ
              </button>
              <button 
                onClick={() => handleSuggestion("Cô hướng dẫn chi tiết cho em bài toán về Axit - Bazơ.")}
                className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                Hướng dẫn chi tiết
              </button>
              <button 
                onClick={() => handleSuggestion("Em cần giải chi tiết bài toán hoá học hữu cơ này.")}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-full text-white text-xs font-semibold shadow-lg shadow-indigo-200"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Giải chi tiết
              </button>
              {attachments.length > 0 && (
                <button 
                  onClick={() => handleSend("", true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 transition-colors rounded-full text-white text-xs font-semibold shadow-lg shadow-emerald-200"
                >
                  <ScanText className="w-3.5 h-3.5" />
                  Quét tài liệu (OCR)
                </button>
              )}
            </div>

            {/* Input Bar */}
            <div className="relative group">
              <div className="absolute inset-x-0 bottom-0 top-0 bg-white dark:bg-slate-800 rounded-[32px] shadow-xl shadow-slate-200 dark:shadow-black/20 group-focus-within:ring-2 ring-indigo-500/20 transition-all"></div>
              <div className="relative flex items-center gap-4 px-6 py-2">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingFiles}
                    className="text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                    title="Đính kèm ảnh/tài liệu/PDF/Word"
                  >
                    {isProcessingFiles ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </button>
                </div>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect}
                  multiple 
                  className="hidden" 
                  accept="image/*,application/pdf,.docx"
                />

                <input 
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Nhập câu hỏi hoặc tải tài liệu quét OCR..."
                  className="flex-1 bg-transparent border-none outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400 text-sm py-1.5"
                />
                
                <div className="flex items-center gap-2">
                  {attachments.length > 0 && !inputValue.trim() && (
                    <button 
                      onClick={() => handleSend("", true)}
                      title="Quét tài liệu"
                      className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-all"
                    >
                      <ScanText className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => handleSend()}
                    disabled={(!inputValue.trim() && attachments.length === 0) || isLoading}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      (inputValue.trim() || attachments.length > 0) && !isLoading 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-100 hover:scale-105 active:scale-95' 
                        : 'bg-indigo-100 text-indigo-400 scale-95'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Copyright at the very bottom */}
        <div className="text-center text-[10px] font-bold text-[#5e66d1] dark:text-[#7f88f5] uppercase tracking-[3px] opacity-70 shrink-0">
          © 2026 EDITOR BY LÊ THỊ KIỀU ANH - HỌC TẬP THÔNG MINH
        </div>
      </motion.main>

      {/* Decorative Right Edge */}
      <div className="w-12 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 shrink-0">
        <button 
          onClick={handleNextLesson}
          className="w-10 h-10 flex items-center justify-center hover:text-indigo-500 transition-colors"
        >
           <ChevronRight className="w-8 h-8" />
        </button>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#1a1f28] w-full max-w-[480px] rounded-[32px] shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden transition-colors"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#e6f9f3] dark:bg-emerald-900/20 flex items-center justify-center text-[#00c68a]">
                    <Settings className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1a202c] dark:text-white">Cài đặt AI & API Key</h3>
                </div>
                <div className="flex items-center gap-2">
                  <MoreHorizontal className="w-5 h-5 text-slate-300 cursor-pointer" />
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                {/* Section 1: AI Model */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-[11px] font-bold text-[#00c68a] uppercase tracking-wider">1. TRÍ TUỆ NHÂN TẠO</h4>
                    <span className="px-2 py-0.5 bg-[#e6f9f3] dark:bg-emerald-900/20 text-[#00c68a] dark:text-emerald-400 text-[9px] font-bold rounded-md">Recommended</span>
                  </div>
                  
                  <div className="space-y-2">
                    {[
                      { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash Preview', default: true },
                      { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro Preview', default: false },
                      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', default: false },
                    ].map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                          selectedModel === model.id 
                            ? 'border-[#00c68a] bg-[#f0fdf9] dark:bg-emerald-900/10' 
                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-emerald-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                            selectedModel === model.id ? 'border-[#00c68a]' : 'border-slate-300 dark:border-slate-600'
                          }`}>
                            {selectedModel === model.id && <div className="w-2 bg-[#00c68a] rounded-full h-2" />}
                          </div>
                          <span className={`font-semibold text-xs transition-colors ${
                            selectedModel === model.id ? 'text-[#1a202c] dark:text-white' : 'text-slate-500 dark:text-slate-400'
                          }`}>
                            {model.name}
                          </span>
                        </div>
                        {model.default && (
                          <span className="bg-[#e6f9f3] dark:bg-emerald-900/30 text-[#00c68a] dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase">Mặc định</span>
                        )}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Section 2: API Key */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[11px] font-bold text-[#00c68a] uppercase tracking-wider">2. GEMINI API KEY</h4>
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-500 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity"
                    >
                      LẤY KEY <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="bg-[#fff9f2] dark:bg-orange-950/10 border border-[#fee9d1] dark:border-orange-900/20 rounded-xl p-3 flex items-center gap-3 mb-3">
                    <div className="text-orange-500 shrink-0">
                      <Lightbulb className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-[#8a5b2a] dark:text-orange-300 leading-relaxed font-medium">
                      Nếu chưa có key, lấy tại <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="font-bold underline decoration-2 underline-offset-4 decoration-current">Google AI Studio</a>.
                    </p>
                  </div>

                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600">
                      <Key className="w-4 h-4 -rotate-45" />
                    </div>
                    <input 
                      type="password"
                      placeholder="Nhập API Key của bạn..."
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      className="w-full bg-[#f8f9fc] dark:bg-[#151921] border border-slate-100 dark:border-slate-800 rounded-xl py-3 pl-11 pr-6 text-slate-600 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 ring-[#00c68a]/20 transition-all text-xs font-sans"
                    />
                  </div>
                </section>

                {/* Section 3: Data Storage */}
                <section>
                  <h4 className="text-[11px] font-bold text-[#00c68a] uppercase tracking-wider mb-3">3. LƯU TRỮ DỮ LIỆU (TÙY CHỌN)</h4>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600">
                      <Database className="w-4 h-4" />
                    </div>
                    <input 
                      type="text"
                      placeholder="Google Sheets Web App URL..."
                      value={googleSheetsUrl}
                      onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                      className="w-full bg-[#f8f9fc] dark:bg-[#151921] border border-slate-100 dark:border-slate-800 rounded-xl py-3 pl-11 pr-6 text-slate-600 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 ring-[#00c68a]/20 transition-all text-xs font-sans"
                    />
                  </div>
                </section>

                <section>
                  <h4 className="text-[11px] font-bold text-[#00c68a] uppercase tracking-wider mb-3">4. THÔNG TIN CỦA EM</h4>
                  <div className="relative">
                    <input 
                      type="text"
                      value={userName}
                      onChange={(e) => {
                        const val = e.target.value;
                        const capitalized = val.split(' ').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ');
                        setUserName(capitalized);
                        localStorage.setItem('userName', capitalized);
                      }}
                      placeholder="Nhập tên của em..."
                      className="w-full bg-[#f8f9fc] dark:bg-[#171c26] border border-slate-100 dark:border-slate-800 rounded-xl py-3 px-4 outline-none focus:border-emerald-500/50 transition-all font-bold text-slate-700 dark:text-white text-sm text-center"
                    />
                  </div>
                </section>

                <div className="flex items-center justify-between pt-1">
                  <button 
                    onClick={handleClearApiKey}
                    className="text-[10px] font-bold text-red-500 uppercase tracking-wider hover:underline"
                  >
                    XÓA KEY ĐÃ LƯU
                  </button>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">Bảo mật thông tin cá nhân.</span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 flex items-center justify-end gap-5 shrink-0 border-t border-slate-50 dark:border-slate-800">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="font-bold text-xs text-[#4a5568] hover:text-slate-800 dark:hover:text-slate-200 transition-colors px-3 py-2"
                >
                  Đóng
                </button>
                <button 
                  onClick={() => {
                    setShowSettings(false);
                  }}
                  className="px-8 py-3 bg-[#00c68a] hover:bg-[#00b07a] text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 dark:shadow-none text-xs transition-all active:scale-95"
                >
                  Lưu cài đặt
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear Chat Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#1a1f28] w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden transition-colors"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 mx-auto mb-6">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3">Xoá cuộc trò chuyện?</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Em có muốn xoá toàn bộ lịch sử cuộc trò chuyện này để bắt đầu nội dung mới không? Thao tác này không thể hoàn tác.
                </p>
              </div>
              <div className="flex border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-4 text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-r border-slate-100 dark:border-slate-800"
                >
                  Hủy bỏ
                </button>
                <button 
                  onClick={confirmClearChat}
                  className="flex-1 py-4 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                  Xác nhận xoá
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#1a1f28] w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden transition-colors"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 mx-auto mb-6">
                  <LogOut className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3">Đăng xuất khỏi phòng học?</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Em có chắc chắn muốn đăng xuất và rời khỏi phòng học của cô Kiều Anh không?
                </p>
              </div>
              <div className="flex border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-4 text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-r border-slate-100 dark:border-slate-800"
                >
                  Ở lại học tiếp
                </button>
                <button 
                  onClick={confirmLogout}
                  className="flex-1 py-4 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                  Xác nhận thoát
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Selection Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
            onClick={() => setShowExportModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#1a1f28] w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden transition-colors"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">Xuất nội dung</h3>
                  <button 
                    onClick={() => setShowExportModal(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={handleExportPDF}
                    disabled={exportProgress !== null}
                    className="flex flex-col items-center gap-4 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                      <Download className="w-8 h-8" />
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">Xuất PDF</span>
                  </button>
                  
                  <button 
                    onClick={handleExportDoc}
                    disabled={exportProgress !== null}
                    className="flex flex-col items-center gap-4 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                      <FileText className="w-8 h-8" />
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">Xuất WORD</span>
                  </button>
                </div>
                
                {exportProgress && (
                  <div className="mt-6 flex flex-col items-center gap-2">
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <motion.div 
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        className="w-1/2 h-full bg-indigo-600 rounded-full"
                      />
                    </div>
                    <p className="text-sm font-medium text-indigo-600 animate-pulse">{exportProgress}</p>
                  </div>
                )}
                
                {!exportProgress && (
                  <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400 italic">
                    * Chọn định dạng em muốn tải về để gửi cho học viên nhé!
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
