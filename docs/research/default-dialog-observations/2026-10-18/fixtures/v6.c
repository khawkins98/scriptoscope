/* v6: public System 7 Dialog Manager default-button probe.
 * Source/compile checkpoint only. No manually drawn ring or aux flag writes.
 * Apple TN1148: SetDialogDefaultItem + standard modal filter participation.
 */
#include <Types.h>
#include <Quickdraw.h>
#include <Fonts.h>
#include <Windows.h>
#include <Menus.h>
#include <TextEdit.h>
#include <Dialogs.h>
#include <Events.h>
#include <Controls.h>
#include <Memory.h>
#include <Gestalt.h>
#include <stdio.h>
#include <string.h>
QDGlobals qd;
static DialogPtr dialog;
static WindowPtr info;
static ControlHandle control;
static ModalFilterProcPtr standardFilter;
static OSErr defaultErr=-1,filterErr=-1;
static short itemType=0,initialDefault=-1,initialAcid=-1,initialFlag=-1,lastHit=0;
static long standardCalls=0,lastRefresh=0,returns=0;
static Boolean quit=false;
static void text(short x,short y,const char*s){unsigned char p[256];short n=strlen(s);p[0]=n;memcpy(p+1,s,n);MoveTo(x,y);DrawString(p);}
/* Read-only telemetry. Never writes the ControlRecord or Acid payload. */
static void readAcid(short *magic,short *flag){
 Handle h;long signature=0;*magic=-1;*flag=-1;
 if(!control)return;h=(*control)->contrlData;
 if(!h||!*h||GetHandleSize(h)<31)return;
 memcpy(&signature,*h,4);*magic=signature==0x41636964L;
 if(*magic)*flag=(unsigned char)(*h)[30];
}
static void metadata(void){
 GrafPtr saved;Point origin={0,0};Rect r={0,0,0,0};GDHandle dev=GetGDevice();
 short magic=-1,flag=-1;long sys=0;char line[240];
 GetPort(&saved);if(control)r=(*control)->contrlRect;readAcid(&magic,&flag);
 SetPort((GrafPtr)dialog);LocalToGlobal(&origin);Gestalt('sysv',&sys);
 SetPort(info);TextFont(0);TextSize(12);EraseRect(&info->portRect);
 sprintf(line,"DefaultDialogProbe v6 | System=%lx guest depth=%d",sys,(**(**dev).gdPMap).pixelSize);text(10,18,line);
 sprintf(line,"SetDialogDefaultItem(1) err=%d GetStdFilterProc err=%d",defaultErr,filterErr);text(10,38,line);
 sprintf(line,"actual port=(%d,%d,%d,%d) global=(%d,%d)",dialog->portRect.left,dialog->portRect.top,dialog->portRect.right,dialog->portRect.bottom,origin.h,origin.v);text(10,58,line);
 sprintf(line,"itemType=%d control=(%d,%d,%d,%d) hilite=%d titleLen=%d",itemType,r.left,r.top,r.right,r.bottom,control?(*control)->contrlHilite:-1,control?(*control)->contrlTitle[0]:-1);text(10,78,line);
 sprintf(line,"dialogActive=%d actual aDefItem=%d (initial=%d)",FrontWindow()==(WindowPtr)dialog,((DialogPeek)dialog)->aDefItem,initialDefault);text(10,98,line);
 sprintf(line,"Acid magic=%d flag=%d (before setter=%d/%d)",magic,flag,initialAcid,initialFlag);text(10,118,line);
 sprintf(line,"standard calls=%ld returned item=%d hit count=%ld",standardCalls,lastHit,returns);text(10,138,line);
 text(10,158,"Normal only. Return tests default. Q exits. No ring/flag writes.");
 SetPort(saved);lastRefresh=TickCount();
}
static pascal Boolean filter(DialogPtr d,EventRecord *event,short *itemHit){
 Boolean handled=false;
 /* All ordinary dialog events go through the retrieved ORIGINAL standard proc. */
 if(standardFilter){standardCalls++;handled=standardFilter(d,event,itemHit);}
 if(event->what==updateEvt&&(WindowPtr)event->message==info){BeginUpdate(info);metadata();EndUpdate(info);}
 if(event->what==keyDown&&((event->message&charCodeMask)=='q'||(event->message&charCodeMask)=='Q')){quit=true;*itemHit=32767;handled=true;}
 if(TickCount()-lastRefresh>=30||event->what==activateEvt)metadata();
 return handled;
}
int main(void){
 Rect bounds={90,80,170,240},ir={230,20,410,630},itemRect;Handle list,item=0;ProcPtr proc=0;
 unsigned char *p;short hit=0;
 InitGraf(&qd.thePort);InitFonts();InitWindows();InitMenus();TEInit();InitDialogs(0);InitCursor();
 info=NewCWindow(0,&ir,"\pOriginal Default Dialog Telemetry",true,0,(WindowPtr)-1,false,0);
 /* One DITL item: count-1, zero handle, Rect, enabled push item4, empty title. */
 list=NewHandleClear(16);if(!list)return 1;HLock(list);p=(unsigned char*)*list;
 ((short*)p)[0]=0;((short*)(p+6))[0]=20;((short*)(p+6))[1]=20;((short*)(p+6))[2]=40;((short*)(p+6))[3]=100;p[14]=4;p[15]=0;HUnlock(list);
 dialog=NewColorDialog(0,&bounds,"\pOriginal Default Control",true,0,(WindowPtr)-1,false,0,list);
 if(!dialog)return 2;SetPort((GrafPtr)dialog);TextFont(0);TextSize(12);
 GetDialogItem(dialog,1,&itemType,&item,&itemRect);if(itemType==4&&item)control=(ControlHandle)item;
 initialDefault=((DialogPeek)dialog)->aDefItem;readAcid(&initialAcid,&initialFlag);
 defaultErr=SetDialogDefaultItem(dialog,1);filterErr=GetStdFilterProc(&proc);
 if(filterErr==0&&proc)standardFilter=(ModalFilterProcPtr)proc;
 SelectWindow((WindowPtr)dialog);DrawDialog(dialog);metadata();
 if(defaultErr!=0||filterErr!=0||!standardFilter||!control){
  EventRecord event;while(!quit){if(WaitNextEvent(everyEvent,&event,30,0)&&event.what==keyDown)quit=true;}
 }else while(!quit){ModalDialog(NewModalFilterUPP(filter),&hit);lastHit=hit;if(hit==1)returns++;metadata();}
 DisposeDialog(dialog);DisposeWindow(info);return 0;
}
