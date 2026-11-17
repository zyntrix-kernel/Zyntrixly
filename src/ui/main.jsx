import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {createPortal} from "react-dom";
import {ArrowUpRight,Command as CommandIcon,FileText,MessageCircle,MessagesSquare,Pin,Search,Settings,SlidersHorizontal,Users} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Avatar,AvatarFallback} from "@/components/ui/avatar";
import {Tabs,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "@/components/ui/dialog";
import {Command,CommandInput,CommandList,CommandEmpty,CommandGroup,CommandItem,CommandSeparator} from "@/components/ui/command";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Separator} from "@/components/ui/separator";
import {Card,CardDescription,CardHeader,CardTitle} from "@/components/ui/card";
const FILTERS=[{id:"all",label:"All"},{id:"unread",label:"Unread"},{id:"pinned",label:"Pinned"},{id:"drafts",label:"Drafts"},{id:"groups",label:"Groups"}];
function getSnapshot(){try{return window.ZxV5?.getInboxSnapshot?.()||{filter:"all",preferences:{},counts:{all:0,unread:0,pinned:0,drafts:0,groups:0},items:[]};}catch{return {filter:"all",preferences:{},counts:{all:0,unread:0,pinned:0,drafts:0,groups:0},items:[]};}}
function useInboxSnapshot(){
 const [snapshot,setSnapshot]=useState(getSnapshot);
 useEffect(()=>{
  const refresh=()=>setSnapshot(getSnapshot());
  window.addEventListener("zx:v5:state",refresh);window.addEventListener("zx:conversations-updated",refresh);
  const targets=["sb-chats","sb-groups"].map(id=>document.getElementById(id)).filter(Boolean);
  const observer=typeof MutationObserver!=="undefined"?new MutationObserver(refresh):null;
  targets.forEach(target=>observer?.observe(target,{childList:true,subtree:true}));refresh();
  return ()=>{window.removeEventListener("zx:v5:state",refresh);window.removeEventListener("zx:conversations-updated",refresh);observer?.disconnect();};
 },[]);
 return snapshot;
}
function SmartInbox(){
 const snapshot=useInboxSnapshot(),selected=snapshot.filter||"all";
 return <section className="zx-v5-ui space-y-2 border-b border-border/70 px-2 pb-3 pt-3" aria-label="Smart inbox">
  <div className="flex items-center justify-between px-2"><h3 className="text-sm font-semibold tracking-tight text-foreground">Inbox</h3><span className="text-[11px] text-muted-foreground">Views</span></div>
  <Tabs value={selected} onValueChange={value=>window.ZxV5?.setInboxFilter?.(value)} className="w-full">
   <TabsList className="grid h-auto w-full grid-cols-5 gap-0.5 bg-muted/70 p-1">
    {FILTERS.map(({id,label})=><TabsTrigger key={id} value={id} className="min-w-0 gap-1 px-1.5 py-2 text-[11px] data-[state=active]:bg-background data-[state=active]:text-foreground"><span>{label}</span><span className="text-[10px] tabular-nums text-muted-foreground">{snapshot.counts?.[id]||0}</span></TabsTrigger>)}
   </TabsList>
  </Tabs>
 </section>;
}
function getResults(query,snapshot=getSnapshot()){
 const q=query.trim().toLocaleLowerCase(),conversations=Array.isArray(snapshot.items)?snapshot.items:[],results=[],seen=new Set();
 const push=item=>{if(results.length>=20||seen.has(item.id))return;seen.add(item.id);results.push(item);};
 const commands=[
  {id:"command:new",kind:"command",label:"New conversation",detail:"Start a direct message or group",icon:MessageCircle,action:()=>window.openNewChat?.()},
  {id:"command:settings",kind:"command",label:"Open settings",detail:"Account, privacy and appearance",icon:Settings,action:()=>window.openSettings?.()},
  {id:"command:composer",kind:"command",label:"Focus message composer",detail:"Jump to the current conversation",icon:MessageCircle,action:()=>document.getElementById("msg-inp")?.focus()},
  {id:"command:all",kind:"command",label:"Show all conversations",detail:"Smart Inbox · All",icon:MessagesSquare,action:()=>window.ZxV5?.setInboxFilter?.("all")},
  {id:"command:unread",kind:"command",label:"Show unread conversations",detail:"Smart Inbox · Unread",icon:MessageCircle,action:()=>window.ZxV5?.setInboxFilter?.("unread")},
  {id:"command:pinned",kind:"command",label:"Show pinned conversations",detail:"Smart Inbox · Pinned",icon:Pin,action:()=>window.ZxV5?.setInboxFilter?.("pinned")},
  {id:"command:density",kind:"command",label:"Toggle compact density",detail:"Change conversation-list spacing",icon:SlidersHorizontal,action:()=>window.ZxV5?.setPreference?.("compact",!getSnapshot().preferences?.compact)},
  {id:"command:motion",kind:"command",label:"Toggle reduced motion",detail:"Reduce interface movement",icon:SlidersHorizontal,action:()=>window.ZxV5?.setPreference?.("reducedMotion",!getSnapshot().preferences?.reducedMotion)},
  {id:"command:focus",kind:"command",label:"Toggle focus mode",detail:"Hide navigation while a chat is open",icon:CommandIcon,action:()=>window.ZxV5?.setPreference?.("focusMode",!getSnapshot().preferences?.focusMode)}
 ];
 if(!q){
  commands.slice(0,5).forEach(push);
  conversations.slice(0,7).forEach(item=>push({id:"conversation:"+item.type+":"+item.id,kind:"conversation",label:item.type==="dm"?"@"+item.name:item.name,detail:item.preview||(item.type==="group"?"Group conversation":"Direct message"),item}));
  return results;
 }
 commands.filter(item=>(item.label+" "+item.detail).toLocaleLowerCase().includes(q)).forEach(push);
 conversations.filter(item=>(String(item.name||"")+" "+String(item.preview||"")).toLocaleLowerCase().includes(q)).slice(0,8)
  .forEach(item=>push({id:"conversation:"+item.type+":"+item.id,kind:"conversation",label:item.type==="dm"?"@"+item.name:item.name,detail:item.preview||"Open conversation",item}));
 try{
  const messages=window.ZxSearch?.search?.(query,{limit:8})||[];
  messages.forEach(message=>{
   const item=conversations.find(candidate=>candidate.id===message.conversationId&&candidate.type===message.conversationType);
   push({id:"message:"+message.conversationType+":"+message.conversationId+":"+message.id,kind:"message",
    label:String(message.text||"").replace(/\s+/g," ").slice(0,96)||"Message",
    detail:(item?.name||"Conversation")+" · "+(message.senderUid===window.ME?.uid?"You":"Message")+" · on this device",message,item});
  });
 }catch(error){console.warn("Local message search is unavailable in this session.",error);}
 return results;
}
async function activateResult(result){
 if(!result)return;
 if(result.kind==="command"){result.action?.();return;}
 const item=result.item;
 if(!item){window.toast?.("That conversation is no longer available in the current inbox.",3200);return;}
 try{await window.ZxV5?.openConversation?.(item);}
 catch(error){window.toast?.("Could not open conversation: "+(error.message||"Unknown error"),3200);return;}
 if(result.kind==="message"){
  const row=await window.ZxV5?.waitForMessageRow?.(result.message.id);
  if(!row){window.toast?.("Conversation opened, but that message is not loaded.",3200);return;}
  row.scrollIntoView({behavior:getSnapshot().preferences?.reducedMotion?"auto":"smooth",block:"center"});
  row.classList.remove("zx-v5-message-focus");void row.offsetWidth;row.classList.add("zx-v5-message-focus");
  window.setTimeout(()=>row.classList.remove("zx-v5-message-focus"),1800);
 }
}
function CommandPalette(){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),inbox=useInboxSnapshot();
 const results=useMemo(()=>getResults(query,inbox),[query,open,inbox]);
 const [indexedCount,setIndexedCount]=useState(0);
 useEffect(()=>{
  const show=()=>{setQuery("");setOpen(true);};const hide=()=>setOpen(false);
  window.addEventListener("zx:v5:open-palette",show);window.addEventListener("zx:v5:close-palette",hide);
  return ()=>{window.removeEventListener("zx:v5:open-palette",show);window.removeEventListener("zx:v5:close-palette",hide);};
 },[]);
 useEffect(()=>{window.__zxV5PaletteOpen=open;if(open)setIndexedCount(window.ZxSearch?.getIndexedCount?.()||0);return ()=>{window.__zxV5PaletteOpen=false;};},[open,query]);
 const run=async result=>{setOpen(false);window.ZxV5?.closePalette?.();await activateResult(result);};
 return <Dialog open={open} onOpenChange={next=>{setOpen(next);if(!next)window.ZxV5?.closePalette?.();}}>
  <DialogContent className="zx-v5-ui max-w-[620px]" aria-describedby="zx-v5-palette-description">
   <DialogHeader className="border-b border-border/70 pr-12">
    <DialogTitle className="flex items-center gap-2"><span className="inline-flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><CommandIcon className="size-4"/></span>Search Zyntrixly</DialogTitle>
    <DialogDescription id="zx-v5-palette-description">Find conversations, messages and actions.</DialogDescription>
   </DialogHeader>
   <Command shouldFilter={false} className="zx-v5-ui">
    <CommandInput value={query} onValueChange={setQuery} placeholder="Search people, messages or actions…"/>
    <ScrollArea className="max-h-[min(58vh,420px)]">
     <CommandList className="max-h-none">
      <CommandEmpty><Card className="mx-auto max-w-sm border-dashed bg-transparent shadow-none"><CardHeader className="items-center pb-2"><Search className="size-5 text-muted-foreground"/><CardTitle className="text-sm">No matches</CardTitle><CardDescription>Try another name, phrase or action.</CardDescription></CardHeader></Card></CommandEmpty>
      {results.some(item=>item.kind==="command")&&<CommandGroup heading="Actions">{results.filter(item=>item.kind==="command").map(result=>{const Icon=result.icon||ArrowUpRight;return <CommandItem key={result.id} value={result.id} onSelect={()=>run(result)}>
       <span className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-muted/60 text-muted-foreground"><Icon className="size-4"/></span>
       <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{result.label}</span><span className="block truncate text-xs text-muted-foreground">{result.detail}</span></span>
       <Badge variant="outline" className="shrink-0">Action</Badge>
      </CommandItem>;})}</CommandGroup>}
      {results.some(item=>item.kind==="conversation")&&<><CommandSeparator/><CommandGroup heading="Conversations">{results.filter(item=>item.kind==="conversation").map(result=><CommandItem key={result.id} value={result.id} onSelect={()=>run(result)}>
       <Avatar className="size-8"><AvatarFallback>{result.item?.type==="group"?"#":String(result.item?.name||"?").slice(0,1).toUpperCase()}</AvatarFallback></Avatar>
       <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{result.label}</span><span className="block truncate text-xs text-muted-foreground">{result.detail}</span></span>
       <Badge variant="secondary">{result.item?.type==="group"?"Group":"Direct"}</Badge>
      </CommandItem>)}</CommandGroup></>}
      {results.some(item=>item.kind==="message")&&<><CommandSeparator/><CommandGroup heading="Messages from this session">{results.filter(item=>item.kind==="message").map(result=><CommandItem key={result.id} value={result.id} onSelect={()=>run(result)}>
       <span className="inline-flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground"><MessageCircle className="size-4"/></span>
       <span className="min-w-0 flex-1"><span className="block truncate text-sm">{result.label}</span><span className="block truncate text-xs text-muted-foreground">{result.detail}</span></span>
       <Badge variant="outline">Message</Badge>
      </CommandItem>)}</CommandGroup></>}
     </CommandList>
    </ScrollArea>
    <Separator/>
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-[11px] text-muted-foreground"><span>↑ ↓ navigate · Enter open · Esc close</span><span>{indexedCount} messages indexed on this device</span></div>
   </Command>
  </DialogContent>
 </Dialog>;
}
function PaletteShortcut({mobile=false}){
 return <Button type="button" variant={mobile?"ghost":"outline"} size={mobile?"icon":"sm"} className={mobile?"size-9":"h-[30px] gap-2 px-2 text-xs"} aria-label="Open Zyntrixly search" title="Search conversations and messages · Ctrl or Command K" onClick={()=>window.ZxV5?.openPalette?.()}>
  {mobile?<Search className="size-4"/>:<><Search className="size-3.5"/><span>Search</span><kbd className="zx-v5-command-kbd">⌘ K</kbd></>}
 </Button>;
}
function V5App(){
 const inbox=document.getElementById("zx-v5-inbox-root"),shortcut=document.getElementById("zx-v5-shortcut-root"),mobile=document.getElementById("zx-v5-mobile-shortcut-root");
 return <div className="zx-v5-ui">{inbox?createPortal(<SmartInbox/>,inbox):null}{shortcut?createPortal(<PaletteShortcut/>,shortcut):null}{mobile?createPortal(<PaletteShortcut mobile/>,mobile):null}<CommandPalette/></div>;
}
const mount=document.getElementById("zx-v5-ui-root");if(mount)createRoot(mount).render(<V5App/>);
