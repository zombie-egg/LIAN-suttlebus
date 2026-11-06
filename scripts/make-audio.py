# macOS 开发素材生成；已经生成的音频随源码交付，运行项目不依赖此脚本。
import subprocess
from pathlib import Path
base=Path(__file__).resolve().parents[1]/'miniprogram/audio'
phrases={'arrival':('车辆即将到站，请做好乘车准备，注意安全。','Your shuttle is arriving. Please get ready at the stop.'),'enabled':('到站提醒已开启，请保持页面打开。','Arrival reminder enabled. Please keep this page open.'),'task':('您有排班任务，请查看并确认任务详情。','You have a dispatch task. Please review and accept it.'),'departure':('发车时间到了，请做好发车准备。','It is departure time. Please prepare for departure.'),'phrase0':('请在站台内有序候车。','Please queue inside the stop.'),'phrase1':('下一站是公共教学楼。','Next stop is the Teaching Center.'),'phrase2':('请保管好随身物品。','Please take care of your belongings.'),'phrase3':('车辆故障，请等待后续车辆。','Vehicle fault. Please wait for the next shuttle.')}
for name,pair in phrases.items():
 for lang,text in zip(['zh','en'],pair):
  tmp=base/(name+'-'+lang+'.aiff');out=base/(name+'-'+lang+'.wav')
  subprocess.run(['say','-v','Tingting' if lang=='zh' else 'Samantha','-o',str(tmp),text],check=True)
  subprocess.run(['afconvert','-f','WAVE','-d','LEI16@16000',str(tmp),str(out)],check=True);tmp.unlink()
