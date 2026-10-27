/* Independently authored capture facilitator, 2026-10-27.
 * Public Window Manager calls only. No original engine implementation.
 * A selects target; I selects an unobscuring second window; C records CURRENT
 * state without selecting; Q quits. Not an admitted reference or font oracle.
 */
#include <Types.h>
#include <Quickdraw.h>
#include <Fonts.h>
#include <Windows.h>
#include <Menus.h>
#include <TextEdit.h>
#include <Dialogs.h>
#include <Events.h>
#include <Files.h>
#include <Gestalt.h>
#include <stdio.h>
#include <string.h>
QDGlobals qd;
static WindowPtr target,other;
static unsigned long launched;
static short sequence=0;
static char receiptName[64]="No capture yet",receiptStatus[128]="",receiptCounts[128]="";
static void text(short y,const char *s){Str255 p;short n=strlen(s);if(n>255)n=255;p[0]=n;memcpy(p+1,s,n);MoveTo(8,y);DrawString(p);}
static void body(WindowPtr w){SetPort(w);EraseRect(&w->portRect);if(w==target){text(20,"A active | I inactive | C record | Q quit");text(40,"Title font/provider/clip: UNKNOWN");}else {text(20,"Activation witness");text(38,receiptName);text(54,receiptStatus);text(70,receiptCounts);}}
static void record(void){
 char b[2048],name[64];Str255 p,vol;short ref=-1,vref=0;long requested,written,eof=-1,sys=0;
 OSErr create,open,write,close,flush,reopen,getEOF,readClose;Point origin={0,0};Rect frame,content;
 Boolean active=FrontWindow()==target,hilited=((WindowPeek)target)->hilited;unsigned long now;GrafPtr saved;
 if(sequence>=2||(!sequence&&(!active||!hilited))||(sequence==1&&(active||hilited||FrontWindow()!=other)))return;
 GetPort(&saved);SetPort(target);LocalToGlobal(&origin);SetPort(saved);
 frame=(**((WindowPeek)target)->strucRgn).rgnBBox;content=(**((WindowPeek)target)->contRgn).rgnBBox;
 Gestalt('sysv',&sys);GetDateTime(&now);sequence++;
 sprintf(name,"TBP-%08lx-%d.txt",launched,sequence);p[0]=strlen(name);memcpy(p+1,name,p[0]);
 requested=sprintf(b,"status=QUARANTINED_PARTIAL\rfixture=TitlebarPair-v1\rlaunchDate=%lu\rcapturedDate=%lu\rsequence=%d\rtitle=Agjpqy 0123\rrequestedContent=240,120\rwindowProc=0\rfrontIsTarget=%d\rtargetHilited=%d\rfrontIsWitness=%d\rframeLTRB=%d,%d,%d,%d\rcontentLTRB=%d,%d,%d,%d\rglobalPortOrigin=%d,%d\rsystemVersionHex=%lx\rtitleFont=UNKNOWN\rtitleFontProvider=UNKNOWN\rtitleClip=UNKNOWN\rwidgetRects=UNKNOWN\rcaptureComplete=1\r",launched,now,sequence,active,hilited,FrontWindow()==other,frame.left,frame.top,frame.right,frame.bottom,content.left,content.top,content.right,content.bottom,origin.h,origin.v,sys);
 if(GetVol(vol,&vref))return;create=HCreate(vref,2,p,'TBP1','TEXT');if(create)return;
 open=HOpen(vref,2,p,2,&ref);if(open)return;written=requested;write=FSWrite(ref,&written,b);close=FSClose(ref);flush=FlushVol((ConstStringPtr)0,vref);
 reopen=HOpen(vref,2,p,1,&ref);getEOF=32767;readClose=32767;if(!reopen){getEOF=GetEOF(ref,&eof);readClose=FSClose(ref);}
 strcpy(receiptName,name);sprintf(receiptStatus,"w%d c%d f%d r%d e%d rc%d",write,close,flush,reopen,getEOF,readClose);sprintf(receiptCounts,"expected=%ld written=%ld EOF=%ld",requested,written,eof);body(other);
 /* Drawing the witness body does not select it. A framebuffer capture must
  * additionally retain these statuses, the title and unobscured target. */
}
int main(void){EventRecord e;Boolean quit=false;Rect t={90,80,210,320},o={300,350,400,630};
 InitGraf(&qd.thePort);InitFonts();InitWindows();InitMenus();TEInit();InitDialogs(0);InitCursor();GetDateTime(&launched);
 other=NewCWindow(0,&o,"\pActivation witness",true,0,(WindowPtr)-1,false,0);
 target=NewCWindow(0,&t,"\pAgjpqy 0123",true,0,(WindowPtr)-1,true,0);if(!target||!other)return 2;
 body(other);body(target);SelectWindow(target);
 while(!quit)if(WaitNextEvent(everyEvent,&e,1,0)){
  if(e.what==updateEvt){WindowPtr w=(WindowPtr)e.message;SetPort(w);BeginUpdate(w);body(w);EndUpdate(w);}
  else if(e.what==keyDown){short c=e.message&charCodeMask;if(c=='a'||c=='A')SelectWindow(target);else if(c=='i'||c=='I')SelectWindow(other);else if(c=='c'||c=='C')record();else if(c=='q'||c=='Q')quit=true;}
 }
 DisposeWindow(target);DisposeWindow(other);return 0;
}
