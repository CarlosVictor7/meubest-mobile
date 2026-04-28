# Design Parity — Web Mobile vs App Mobile

> Documento de referência para garantir que o app `meubest-mobile` seja fiel
> à versão mobile web validada pelo cliente em `meu.best`.

---

## Paleta de Cores

| Token | Web Class | Valor Hex | Uso |
|---|---|---|---|
| **Primary** | `dbm-red` | `#E1301D` | Botões, tabs ativas, badges, títulos |
| **Primary Dark** | — | `#C4200A` | Hover / pressed |
| **Background** | `dbm-cream` | `#FDF6F0` | Fundo global de todas as telas |
| **Surface** | — | `#FFFFFF` | Cards, modais |
| **Pink Accent** | `dbm-pink` | `#FCE7E9` | Bordas de cards, fundo de badges |
| **Dark Text** | `dbm-darkblue` | `#1A1A1A` | Texto principal |
| **Dark Card BG** | — | `#1A1A1A` | BlackCards (Disponibilidade, Progresso, Indique) |

---

## Tipografia

| Elemento | Web | Mobile |
|---|---|---|
| Fonte display | `Outfit` (font-black, uppercase, tracking-tighter) | `Inter 900` (sem instalação adicional) |
| Fonte body | `Inter` | `Inter` (sistema) |
| Título de tela | `text-4xl brutal-title` | `fontSize: 36, fontWeight: 900, letterSpacing: -0.5` |
| Labels uppercase | `text-xs font-black uppercase tracking-widest` | `fontSize: 10, fontWeight: 900, letterSpacing: 3` |
| Corpo | `text-base font-medium` | `fontSize: 14, fontWeight: 500` |

---

## Border Radius

| Uso | Web | Mobile (theme.ts) |
|---|---|---|
| Cards grandes | `rounded-[40px]` | `borderRadius.xl = 40` |
| Modais | `rounded-[40px]` | `borderRadius.xl = 40` |
| Botões pill | `rounded-full` | `borderRadius.full = 9999` |
| Tags/badges | `rounded-full` | `borderRadius.full = 9999` |
| Cards médios | `rounded-[30px]` | `borderRadius.lg = 28` |

---

## Sombras

| Elemento | Web | Mobile |
|---|---|---|
| Card padrão | `shadow-sm` / `border-2 border-dbm-pink` | `shadows.sm` + `borderColor: #FCE7E9` |
| CTA principal | `shadow-2xl` | `shadows.primary` (shadowColor: #E1301D) |
| BottomNav | `shadow-[0_15px_45px_rgba(0,0,0,0.15)]` | `shadows.nav` |
| Modais | `shadow-2xl` | `shadows.lg` |

---

## Componentes Mapeados

### Header Mobile
```
Web:       bg-white border-b-2 border-dbm-pink
Mobile:    backgroundColor: #FFF, borderBottomColor: #FCE7E9, borderBottomWidth: 2

Web:       Avatar: bg-dbm-red rounded-xl rotate-6 (inicial do nome)
Mobile:    avatarInitial: borderRadius: 14, rotate: 6deg, backgroundColor: #E1301D
```

### BottomNav Flutuante
```
Web:       bg-white/95 backdrop-blur-2xl border-[3px] border-dbm-pink rounded-[35px]
Mobile:    backgroundColor: rgba(255,255,255,0.97), borderRadius: 35, borderWidth: 3

Web:       Botão COMEÇAR: bg-dbm-red w-20 h-20 rounded-[28px] rotate-3 border-4 border-white
Mobile:    width: 76, height: 76, borderRadius: 26, transform: rotate(3deg)

Web:       Ativo: text-dbm-red bg-dbm-pink/15
Mobile:    color: #E1301D, backgroundColor: rgba(225,48,29,0.12)
```

### BlackCard (Card preto)
```
Web:       bg-dbm-darkblue (bg-[#1A1A1A]) rounded-[40px] p-8
Mobile:    backgroundColor: #1A1A1A, borderRadius: 40, padding: 32

Web:       Título: brutal-title-white (Outfit black uppercase)
Mobile:    fontWeight: 900, textTransform: uppercase

Web:       Botão interno: bg-white text-dbm-darkblue rounded-full
Mobile:    backgroundColor: #FFF, borderRadius: 9999
```

### NoticeCard (Aviso Importante)
```
Web:       bg-white border-4 border-dbm-pink rounded-[30px]
Mobile:    backgroundColor: #FFF, borderWidth: 3, borderColor: #FCE7E9, borderRadius: 40

Web:       Ícone: bg-dbm-red/10 p-4 rounded-2xl rotate-3
Mobile:    backgroundColor: rgba(225,48,29,0.12), transform: rotate(3deg)
```

### StatsCard
```
Web:       bg-white border-2 border-dbm-pink rounded-[30px]
Mobile:    backgroundColor: #FFF, borderWidth: 1, borderColor: #FCE7E9, borderRadius: 40

Web:       Valor: font-display font-bold text-dbm-red
Mobile:    fontSize: 22, fontWeight: 900, color: #E1301D
```

### SegmentedControl (RoleToggle)
```
Web:       bg-white border-2 border-dbm-pink rounded-full flex gap-1 p-1
Mobile:    backgroundColor: #FFF, borderRadius: 9999, padding: 4

Web:       Ativo: bg-dbm-red text-white rounded-full
Mobile:    backgroundColor: #E1301D, color: #FFF, borderRadius: 9999
```

---

## Card de Sessões

```
Web:       bg-white rounded-[40px] border-4 border-dbm-pink p-8-10
Mobile:    backgroundColor: #FFF, borderRadius: 40, borderWidth: 3, borderColor: #FCE7E9

Web:       Próxima sessão: border-4 border-dbm-red shadow-2xl (destaque)
Mobile:    borderWidth: 4, borderColor: #E1301D, ...shadows.lg (destaque na primeira)

Web:       Empty state: bg-dbm-cream/30 border-2 dashed border-dbm-pink/30 rounded-[32px]
Mobile:    backgroundColor: rgba(253,246,240,0.3), borderStyle: dashed, borderColor: rgba(252,231,233,0.5)
```

---

## Bottom Navigation — Tabs

| ID | Label | Ícone | Web Route |
|---|---|---|---|
| `home` | Início | `User` | overview |
| `sessions` | Sessões | `Calendar` | sessions |
| _(central)_ | COMEÇAR | `Zap` | — (modal) |
| `wallet` | Carteira | `CreditCard` | wallet |
| `menu` | Menu | `Settings` | settings |

---

## Fluxo de Auth

```
Tela de Login
    ↓
[Continuar com Google] (CTA principal, vermelho, pill)
    ↓ Expo Go?
        → Alert amigável + opção "Usar e-mail"
    ↓ Dev Build?
        → Google OAuth → Firebase → Firestore upsert
        
[Entrar com e-mail] (visível apenas se EXPO_PUBLIC_ENABLE_DEV_EMAIL_LOGIN=true)
    → Para testes no Expo Go
```

---

## Glossário de Variáveis .env

| Variável | Descrição |
|---|---|
| `EXPO_PUBLIC_ENABLE_DEV_EMAIL_LOGIN` | `true` = mostra form email/senha. Remover em produção |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Client ID do OAuth Web (Firebase Console) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Client ID OAuth iOS (para dev build) |
