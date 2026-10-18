#include <Types.h>
#include <Quickdraw.h>
#include <Fonts.h>
#include <Windows.h>
#include <Menus.h>
#include <TextEdit.h>
#include <Dialogs.h>
#include <Events.h>
#include <Controls.h>
#include <Gestalt.h>
#include <stdio.h>
#include <string.h>
QDGlobals qd;
static WindowPtr target,info,board;
static RGBColor samples[5],bodySample,edgeSample;
static ControlHandle control;
static short states[3]={0,10,255},which=0;
static void text(short x,short y,const char*s){unsigned char p[256];short n=strlen(s);p[0]=n;memcpy(p+1,s,n);MoveTo(x,y);DrawString(p);}
static void face(void){RGBColor white={65535,65535,65535};SetPort(target);TextFont(0);TextSize(12);RGBBackColor(&white);EraseRect(&target->portRect);Draw1Control(control);HiliteControl(control,states[which]);}
static void sentinel(void){
 RGBColor colors[5]={{65535,0,0},{0,65535,0},{0,0,65535},{65535,65535,65535},{0,0,0}};
 SetPort(board);for(short i=0;i<5;i++){Rect r={10,10+i*32,30,30+i*32};RGBForeColor(&colors[i]);PaintRect(&r);GetCPixel(20+i*32,20,&samples[i]);}
}
static void metadata(void){
 char line[240],font[256];Str255 name;Point origin={0,0};GDHandle dev=GetGDevice();long sys=0,machine=0;FontInfo fi;Rect r=(*control)->contrlRect;
 sentinel();SetPort(target);GetCPixel(60,30,&bodySample);GetCPixel(60,38,&edgeSample);LocalToGlobal(&origin);GetFontInfo(&fi);GetFontName(target->txFont,name);memcpy(font,name+1,name[0]);font[name[0]]=0;
 Gestalt('sysv',&sys);Gestalt('mach',&machine);SetPort(info);TextFont(0);TextSize(12);EraseRect(&info->portRect);
 sprintf(line,"SingleControlProbe v5 | sys=%lx machine=%ld depth=%d",sys,machine,(**(**dev).gdPMap).pixelSize);text(12,18,line);
 sprintf(line,"actual port=(%d,%d,%d,%d) global-origin=(%d,%d)",target->portRect.left,target->portRect.top,target->portRect.right,target->portRect.bottom,origin.h,origin.v);text(12,38,line);
 sprintf(line,"actual control=(%d,%d,%d,%d) hilite=%d empty-title=%d",r.left,r.top,r.right,r.bottom,(*control)->contrlHilite,(*control)->contrlTitle[0]==0);text(12,58,line);
 sprintf(line,"font=%s(%d) size=%d ascent=%d descent=%d leading=%d",font,target->txFont,target->txSize,fi.ascent,fi.descent,fi.leading);text(12,78,line);
 sprintf(line,"targetActive=%d | NewControl proc=0; origin stays zero",FrontWindow()==target);text(12,98,line);
 sprintf(line,"Face(60,30) RGB16=(%04x,%04x,%04x)",bodySample.red,bodySample.green,bodySample.blue);text(12,123,line);
 sprintf(line,"Edge(60,38) RGB16=(%04x,%04x,%04x)",edgeSample.red,edgeSample.green,edgeSample.blue);text(12,145,line);
}
int main(void){
 EventRecord e;Rect tr={90,80,170,240},ir={230,40,390,620},cr={20,20,40,100},br={410,450,470,630};unsigned char empty[1]={0};
 InitGraf(&qd.thePort);InitFonts();InitWindows();InitMenus();TEInit();InitDialogs(0);InitCursor();
 board=NewCWindow(0,&br,"\pRGBWK",true,0,(WindowPtr)-1,false,0);
 info=NewCWindow(0,&ir,"\pOriginal Capture Telemetry",true,0,(WindowPtr)-1,true,0);
 target=NewCWindow(0,&tr,"\pOriginal Control",true,0,(WindowPtr)-1,true,0);SetPort(target);TextFont(0);TextSize(12);control=NewControl(target,&cr,empty,true,0,0,1,0,0);SelectWindow(target);face();metadata();
 while(true){if(WaitNextEvent(everyEvent,&e,1,0)){if(e.what==updateEvt){WindowPtr w=(WindowPtr)e.message;SetPort(w);BeginUpdate(w);if(w==target)face();else if(w==board)sentinel();else metadata();EndUpdate(w);}else if(e.what==activateEvt){if((WindowPtr)e.message==target)metadata();}else if(e.what==mouseDown){WindowPtr w;short part=FindWindow(e.where,&w);if(part==inGoAway&&TrackGoAway(w,e.where))break;else if(w==info){which=(which+1)%3;SelectWindow(target);face();metadata();}else if(w==target){SelectWindow(target);face();metadata();}}}}
 DisposeWindow(target);DisposeWindow(info);return 0;
}
