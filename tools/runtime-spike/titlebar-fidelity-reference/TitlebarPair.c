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
/* Read-only public condition queries. No title font inference or reference admission.
 * Gamma query follows the retained public capture toolkit's PBStatusSync approach.
 * Every emitted byte participates in the caller's write/EOF receipt.
 */
#include <Memory.h>
#include <Resources.h>
#include <Devices.h>
#include <stdarg.h>
#include <stddef.h>
#pragma pack(push,2)
typedef struct TBPGamma {short version,type,formulaBytes,channels,count,width;} TBPGamma;
#pragma pack(pop)
_Static_assert(sizeof(TBPGamma)==12,"Gamma fixed prefix ABI");
_Static_assert(offsetof(VDParamBlock,ioRefNum)==24 && offsetof(VDParamBlock,csParam)==28 && sizeof(VDParamBlock)==32,"Video status ABI");
_Static_assert(sizeof(VDGammaRecord)==4,"Gamma record ABI");
static unsigned char gammaCopy[32768];
static short conditionRef;
static OSErr conditionError;
static long conditionExpected,conditionWritten;
static void conditionLine(const char *format,...){
 char b[512];long n;va_list args;int size;
 if(conditionError)return;
 va_start(args,format);size=vsnprintf(b,sizeof(b)-1,format,args);va_end(args);
 if(size<0||size>=sizeof(b)-1){conditionError=-50;return;}
 b[size++]='\r';n=size;conditionExpected+=size;conditionError=FSWrite(conditionRef,&n,b);
 conditionWritten+=n;if(n!=size&&!conditionError)conditionError=-36;
}
static void conditionBytes(const char *name,const unsigned char *p,long length){
 long offset;static const char hex[]="0123456789abcdef";
 conditionLine("%s.bytes=%ld",name,length);
 for(offset=0;offset<length;offset+=64){char text[129];short i,n=length-offset>64?64:length-offset;
  for(i=0;i<n;i++){unsigned char v=p[offset+i];text[i*2]=hex[v>>4];text[i*2+1]=hex[v&15];}text[n*2]=0;conditionLine("%s.hex.%ld=%s",name,offset,text);}
}
static void conditionFile(short ref){
 FCBPBRec p;Str255 name={0};char text[256];OSErr error;
 memset(&p,0,sizeof(p));p.ioNamePtr=name;p.ioRefNum=ref;p.ioFCBIndx=0;error=PBGetFCBInfoSync(&p);
 conditionLine("Copl.fileQuery=%d ioResult=%d ref=%d",error,p.ioResult,ref);
 if(!error){memcpy(text,name+1,name[0]);text[name[0]]=0;conditionLine("Copl.fileName=%s volume=%d parent=%ld fileID=%ld flags=%u logicalEOF=%ld",text,p.ioFCBVRefNum,p.ioFCBParID,p.ioFCBFlNm,(unsigned short)p.ioFCBFlags,p.ioFCBEOF);}
}
static void observeConditions(short ref){
 GDHandle device;PixMapHandle pix;CTabHandle table;GrafPtr saved;long response=0;OSErr error;short i;
 conditionRef=ref;conditionError=0;conditionExpected=conditionWritten=0;
 GetPort(&saved);SetPort(target);
 error=Gestalt('Copl',&response);conditionLine("Copl.status=%d response=%08lx",error,(unsigned long)response);if(!error)conditionFile((short)response);
 conditionLine("schemeBinding=public-Copl-FCB-plus-stopped-fork;private-provider-cache-order=UNKNOWN");
 device=GetMainDevice();
 if(device&&*device){
  conditionLine("device.ref=%d flags=%u mode=%ld",(**device).gdRefNum,(unsigned short)(**device).gdFlags,(**device).gdMode);
  pix=(**device).gdPMap;
  if(pix&&*pix){
   Rect r=(**pix).bounds;conditionLine("display.depth=%d pixelType=%d rowBytes=%u boundsLTRB=%d,%d,%d,%d",(**pix).pixelSize,(**pix).pixelType,(unsigned short)(**pix).rowBytes,r.left,r.top,r.right,r.bottom);
   table=(**pix).pmTable;
   if(table&&*table){long bytes=GetHandleSize((Handle)table);SignedByte state=HGetState((Handle)table);
    conditionLine("palette.seed=%ld flags=%u lastIndex=%d",(**table).ctSeed,(unsigned short)(**table).ctFlags,(**table).ctSize);
    if(bytes>=8&&bytes<=32768){HLock((Handle)table);conditionBytes("palette",(unsigned char *)*table,bytes);HSetState((Handle)table,state);}
   }
   if((**pix).pixelSize==8)for(i=0;i<256;i++){RGBColor c;Index2Color(i,&c);conditionLine("indexRGB16.%d=%04x,%04x,%04x reverse=%ld",i,c.red,c.green,c.blue,Color2Index(&c));}
  }
  {VDParamBlock p;VDGammaRecord record;TBPGamma header;long bytes=0;
   memset(&p,0,sizeof(p));memset(&record,0,sizeof(record));p.ioRefNum=(**device).gdRefNum;p.csCode=8;p.csParam=(Ptr)&record;
   error=PBStatusSync((ParmBlkPtr)&p);
   if(!error&&!p.ioResult&&record.csGTable){memcpy(&header,record.csGTable,12);
    if(header.version==0&&header.formulaBytes>=0&&header.formulaBytes<=4096&&(header.channels==1||header.channels==3)&&header.count>0&&header.count<=4096&&header.width>0&&header.width<=16){bytes=12L+header.formulaBytes+(long)header.channels*header.count*((header.width+7)/8);if(bytes<=32768)memcpy(gammaCopy,record.csGTable,bytes);else bytes=0;}}
   conditionLine("gamma.status=%d ioResult=%d bytes=%ld",error,p.ioResult,bytes);
   if(bytes)conditionBytes("gamma",gammaCopy,bytes);else conditionLine("gamma=UNKNOWN:query-error-or-unsupported-header");
  }
 }else conditionLine("display=UNKNOWN:no-main-device");
 conditionLine("conditionQueriesComplete=1");SetPort(saved);
}

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
 open=HOpen(vref,2,p,2,&ref);if(open)return;written=requested;write=FSWrite(ref,&written,b);if(!write&&written==requested){observeConditions(ref);requested+=conditionExpected;written+=conditionWritten;if(conditionError)write=conditionError;}close=FSClose(ref);flush=FlushVol((ConstStringPtr)0,vref);
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
