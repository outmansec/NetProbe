package main

import (
	"context"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"
)

// App struct
type App struct {
	ctx            context.Context
	currentLang    string
	translations   map[string]map[string]string
	translationsMu sync.RWMutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		currentLang:  "zh-CN", // 默认语言
		translations: make(map[string]map[string]string),
	}
}

// OnStartup is called when the app starts up
func (a *App) OnStartup(ctx context.Context) {
	a.ctx = ctx
	a.loadTranslations()
}

// 加载翻译文件
func (a *App) loadTranslations() {
	// 直接从硬编码的翻译数据加载，确保始终有可用的翻译
	a.loadHardcodedTranslations()
}

// 加载硬编码的翻译数据，确保始终有可用的翻译
func (a *App) loadHardcodedTranslations() {
	// 中文翻译
	zhCN := map[string]string{
		"errors.parseDataFailed":       "解析数据失败",
		"errors.parseHexFailed":        "解析十六进制失败",
		"errors.invalidSlashHexFormat": "无效的\\x格式十六进制字符串，应以\\x开头",
		"errors.invalidSlashHexLength": "无效的\\x格式十六进制字符串，每个字节应有2个十六进制字符",
		"errors.tcpConnectionFailed":   "TCP连接失败",
		"errors.resolveUdpFailed":      "解析UDP地址失败",
		"errors.udpConnectionFailed":   "UDP连接失败",
		"errors.unsupportedProtocol":   "不支持的协议",
		"errors.sendDataFailed":        "发送数据失败",
		"errors.readDataFailed":        "读取数据失败",
	}

	// 英文翻译
	enUS := map[string]string{
		"errors.parseDataFailed":       "Failed to parse data",
		"errors.parseHexFailed":        "Failed to parse hex value",
		"errors.invalidSlashHexFormat": "Invalid \\x format hex string, should start with \\x",
		"errors.invalidSlashHexLength": "Invalid \\x format hex string, each byte should have 2 hex characters",
		"errors.tcpConnectionFailed":   "TCP connection failed",
		"errors.resolveUdpFailed":      "Failed to resolve UDP address",
		"errors.udpConnectionFailed":   "UDP connection failed",
		"errors.unsupportedProtocol":   "Unsupported protocol",
		"errors.sendDataFailed":        "Failed to send data",
		"errors.readDataFailed":        "Failed to read data",
	}

	a.translationsMu.Lock()
	defer a.translationsMu.Unlock()

	// 初始化翻译映射
	if a.translations == nil {
		a.translations = make(map[string]map[string]string)
	}

	// 添加硬编码的翻译
	if _, ok := a.translations["zh-CN"]; !ok {
		a.translations["zh-CN"] = make(map[string]string)
	}
	for k, v := range zhCN {
		a.translations["zh-CN"][k] = v
	}

	if _, ok := a.translations["en-US"]; !ok {
		a.translations["en-US"] = make(map[string]string)
	}
	for k, v := range enUS {
		a.translations["en-US"][k] = v
	}
}

// 获取翻译文本
func (a *App) translate(key string) string {
	a.translationsMu.RLock()
	defer a.translationsMu.RUnlock()

	if translations, ok := a.translations[a.currentLang]; ok {
		if translation, ok := translations[key]; ok {
			return translation
		}
	}

	// 如果找不到翻译，尝试使用默认语言
	if a.currentLang != "zh-CN" {
		if translations, ok := a.translations["zh-CN"]; ok {
			if translation, ok := translations[key]; ok {
				return translation
			}
		}
	}

	// 如果仍然找不到翻译，返回键名
	return key
}

// 协议类型
type Protocol string

const (
	TCP Protocol = "tcp"
	UDP Protocol = "udp"
)

// ProbeResult 表示网络探测连接的结果
type ProbeResult struct {
	Success  bool   `json:"success"`
	Error    string `json:"error,omitempty"`
	Time     string `json:"time"`
	Length   int    `json:"length"`
	HexGo    string `json:"hexGo"`
	HexSlash string `json:"hexSlash"`
	Decimal  []int  `json:"decimal"`
	String   string `json:"string"`
}

// 数据格式类型
type DataFormat string

const (
	HexComma  DataFormat = "hex_comma"  // 0x68,0x65,0x6c,0x6c,0x6f 格式
	HexSlash  DataFormat = "hex_slash"  // \x68\x65\x6c\x6c\x6f 格式
	RawString DataFormat = "raw_string" // 原始字符串格式
)

// 语言设置
type LanguageSettings struct {
	CurrentLanguage string `json:"currentLanguage"`
}

// GetLanguageSettings 获取当前语言设置
func (a *App) GetLanguageSettings() LanguageSettings {
	return LanguageSettings{
		CurrentLanguage: a.currentLang,
	}
}

// SetLanguage 设置当前语言
func (a *App) SetLanguage(lang string) LanguageSettings {
	a.currentLang = lang
	return LanguageSettings{
		CurrentLanguage: lang,
	}
}

// ConnectProbe 连接网络探测并返回结果
func (a *App) ConnectProbe(ip, port, inputData string, protocol string, dataFormat string) ProbeResult {
	target := fmt.Sprintf("%s:%s", ip, port)

	// 根据选择的格式解析数据
	var sendData []byte
	var err error

	if inputData != "" {
		switch dataFormat {
		case string(HexComma):
			sendData, err = a.parseCommaHexString(inputData)
		case string(HexSlash):
			sendData, err = a.parseSlashHexString(inputData)
		case string(RawString):
			sendData = []byte(inputData)
		default:
			sendData, err = a.parseCommaHexString(inputData) // 默认使用逗号分隔的十六进制
		}

		if err != nil {
			errMsg := a.translate("errors.parseDataFailed")
			return ProbeResult{
				Success: false,
				Error:   fmt.Sprintf("%s: %v", errMsg, err),
			}
		}
	}

	// 确定使用的协议
	var proto Protocol
	if strings.ToLower(protocol) == "udp" {
		proto = UDP
	} else {
		proto = TCP // 默认使用TCP
	}

	// 执行连接
	result, err := a.performConnection(target, sendData, proto)
	if err != nil {
		return ProbeResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	return result
}

func (a *App) parseCommaHexString(s string) ([]byte, error) {
	parts := strings.Split(s, ",")
	var result []byte

	for _, part := range parts {
		part = strings.TrimSpace(part)
		part = strings.TrimPrefix(part, "0x")
		part = strings.TrimPrefix(part, "0X")

		if len(part) == 0 {
			continue
		}

		b, err := strconv.ParseUint(part, 16, 8)
		if err != nil {
			errMsg := a.translate("errors.parseHexFailed")
			return nil, fmt.Errorf("%s: \"%s\": %v", errMsg, part, err)
		}
		result = append(result, byte(b))
	}
	return result, nil
}

// 解析斜杠格式的十六进制字符串 (\x68\x65\x6c\x6c\x6f)
func (a *App) parseSlashHexString(s string) ([]byte, error) {
	// 移除所有空格
	s = strings.ReplaceAll(s, " ", "")

	// 检查字符串是否为空
	if s == "" {
		return []byte{}, nil
	}

	// 按\x分割字符串
	parts := strings.Split(s, "\\x")

	// 第一个元素可能是空字符串，因为字符串可能以\x开头
	if parts[0] == "" {
		parts = parts[1:]
	} else {
		errMsg := a.translate("errors.invalidSlashHexFormat")
		return nil, fmt.Errorf("%s", errMsg)
	}

	var result []byte
	for _, part := range parts {
		if len(part) < 2 {
			errMsg := a.translate("errors.invalidSlashHexLength")
			return nil, fmt.Errorf("%s", errMsg)
		}

		// 取前两个字符作为十六进制值
		hexPart := part[:2]
		b, err := strconv.ParseUint(hexPart, 16, 8)
		if err != nil {
			errMsg := a.translate("errors.parseHexFailed")
			return nil, fmt.Errorf("%s: \"%s\": %v", errMsg, hexPart, err)
		}
		result = append(result, byte(b))
	}

	return result, nil
}

func (a *App) performConnection(target string, data []byte, protocol Protocol) (ProbeResult, error) {
	const timeout = 6 * time.Second
	const bufferSize = 4096

	var conn net.Conn
	var err error

	// 根据协议类型建立连接
	switch protocol {
	case TCP:
		conn, err = net.DialTimeout(string(protocol), target, timeout)
		if err != nil {
			errMsg := a.translate("errors.tcpConnectionFailed")
			return ProbeResult{}, fmt.Errorf("%s: %v", errMsg, err)
		}
		defer conn.Close()
		conn.SetDeadline(time.Now().Add(timeout))

	case UDP:
		udpAddr, err := net.ResolveUDPAddr("udp", target)
		if err != nil {
			errMsg := a.translate("errors.resolveUdpFailed")
			return ProbeResult{}, fmt.Errorf("%s: %v", errMsg, err)
		}

		conn, err = net.DialUDP("udp", nil, udpAddr)
		if err != nil {
			errMsg := a.translate("errors.udpConnectionFailed")
			return ProbeResult{}, fmt.Errorf("%s: %v", errMsg, err)
		}
		defer conn.Close()
		conn.SetDeadline(time.Now().Add(timeout))

	default:
		errMsg := a.translate("errors.unsupportedProtocol")
		return ProbeResult{}, fmt.Errorf("%s: %s", errMsg, protocol)
	}

	buf := make([]byte, bufferSize)

	// 发送数据
	if len(data) > 0 {
		_, err = conn.Write(data)
		if err != nil {
			errMsg := a.translate("errors.sendDataFailed")
			return ProbeResult{}, fmt.Errorf("%s: %v", errMsg, err)
		}
	}

	// 读取响应
	n, err := conn.Read(buf)
	if err != nil && err != io.EOF {
		// UDP协议可能没有响应，这是正常的
		if protocol == UDP && (err == io.EOF || err.(net.Error).Timeout()) {
			// 对于UDP，超时不是错误，因为它是无连接的
			n = 0
		} else {
			errMsg := a.translate("errors.readDataFailed")
			return ProbeResult{}, fmt.Errorf("%s: %v", errMsg, err)
		}
	}

	// 构建十六进制格式（Go风格）
	var hexGoFormat []string
	for _, b := range buf[:n] {
		hexGoFormat = append(hexGoFormat, fmt.Sprintf("0x%02x", b))
	}
	goHex := "[" + strings.Join(hexGoFormat, ", ") + "]"

	// 构建 \xXX 格式的十六进制字符串
	hexString := ""
	for _, b := range buf[:n] {
		hexString += fmt.Sprintf("\\x%02x", b)
	}

	// 转换字节数组为整数数组
	decimal := make([]int, n)
	for i, b := range buf[:n] {
		decimal[i] = int(b)
	}

	return ProbeResult{
		Success:  true,
		Time:     time.Now().Format("2006-01-02 15:04:05"),
		Length:   n,
		HexGo:    goHex,
		HexSlash: hexString,
		Decimal:  decimal,
		String:   string(buf[:n]),
	}, nil
}
