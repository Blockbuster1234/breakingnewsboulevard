import re

NEW_ARTICLES = r'''
  {
    slug: "us-fighter-jet-downed-over-iran-crew-rescued-april-3-2026",
    title: "US Fighter Jet Shot Down Over Iran \u2014 One Crew Member Rescued in Daring Operation",
    excerpt: "A US fighter jet has been shot down over southern Iran, marking the deepest penetration of Iranian airspace in the ongoing war. One crew member has been rescued in a daring search-and-rescue mission, while the fate of a second remains unknown.",
    image: "/images/us-fighter-jet-downed-iran-april-2026.jpg",
    category: "World",
    date: "April 3, 2026",
    author: "Breaking News Boulevard",
    url: "/posts/us-fighter-jet-downed-over-iran-crew-rescued-april-3-2026.html",
    body: """<p>A US fighter jet has been shot down over southern Iran, triggering an emergency search-and-rescue operation deep inside Iranian territory. US media confirmed that one crew member has been successfully recovered, while the fate of a second airman remains unknown. The incident marks one of the most dramatic developments in the five-week-old conflict.</p>

<h2>Rescue Under Fire</h2>
<p>Search-and-rescue teams penetrated deep into southern Iran to locate and recover the first crew member. Video reportedly captured by rescuers appears to show the operation underway, though the Pentagon has released no official details. The depth of the rescue mission \u2014 far inside Iranian-controlled territory \u2014 underscores the risks pilots are taking in contested airspace.</p>
<p>US Central Command has not disclosed the type of aircraft that was downed or the mission it was carrying out at the time. Military analysts say the loss of a fighter jet this deep inside Iran suggests either a malfunction, surface-to-air fire, or a combination of both.</p>

<h2>Second Crew Member Still Missing</h2>
<p>The US military has not confirmed whether the second crew member is alive, captured, or killed. Combat search and rescue operations are ongoing, but Iranian forces are reportedly combing the crash area, complicating the effort. The incident echoes some of the most dangerous rescue missions in modern military history.</p>

<h2>Artemis II Launches Amid Global Tension</h2>
<p>In a stark contrast to the escalating conflict, NASA's Artemis II mission successfully launched from Kennedy Space Center, carrying four astronauts on a lunar flyby \u2014 the first crewed mission to orbit the Moon in over 50 years. Astronaut Reid Wiseman, commander of the mission, later returned a "spectacular" image of Earth from aboard the Orion capsule.</p>
<p>The mission does not include a Moon landing but is seen as a crucial stepping stone toward future lunar landing preparations targeting 2028. For a brief moment, the world looked upward instead of at the battlefields.</p>

<h2>War Rages On</h2>
<p>Despite diplomatic efforts, the conflict shows no sign of ending. Israel launched a rocket strike on a building in Beirut, while fragments of Iranian missiles continue to hit targets in southern Israel, where a factory was struck and a large black smoke cloud rose over the site.</p>
<p>The UN reports that fuel costs and transport disruptions from the war are worsening a hunger crisis in Somalia, highlighting the conflict's devastating ripple effects across the developing world. Meanwhile, families across Lebanon, Iran, and the Gulf states continue to mourn mounting casualties.</p>
"""
  },

  {
    slug: "us-judge-blocks-trump-white-house-ballroom-iran-war-somalia-crisis-april-2-2026",
    title: "Federal Judge Blocks Trump's \u200b$400 Million White House Ballroom \u2014 Iran War Fuels Hunger Crisis in Somalia",
    excerpt: "A US federal judge has blocked President Trump's controversial \u200b$400 million White House ballroom expansion. Meanwhile, the UN warns that fuel and transport disruptions from the Iran war are deepening a hunger crisis in East Africa.",
    image: "/images/courthouse-blocks-trump-ballroom-april-2026.jpg",
    category: "World",
    date: "April 2, 2026",
    author: "Breaking News Boulevard",
    url: "/posts/us-judge-blocks-trump-white-house-ballroom-iran-war-somalia-crisis-april-2-2026.html",
    body: """<p>Washington was rocked by a major legal setback for the White House on Wednesday, as a federal judge blocked President Trump's \u200b$400 million plan to construct a grand ballroom on the White House grounds. The ruling raises fresh questions about executive power and public spending authority as the ongoing Iran war drains both political capital and public patience.</p>

<h2>Court Blocks Ballroom Plans</h2>
<p>The federal judge found that the administration attempted to bypass congressional oversight and proper procurement procedures in pushing forward with the lavish expansion project. The White House had argued the ballroom was necessary for official state functions, but critics called it an extravagant misuse of funds during a time of military conflict and rising domestic costs.</p>
<p>The ruling is likely to be appealed, and the legal battle over the ballroom could drag on for months. Opposition lawmakers hailed the decision as a victory for accountability.</p>

<h2>Iran War Deepens Somalia's Hunger Crisis</h2>
<p>The United Nations has issued a stark warning: the Iran war's disruption to fuel supplies and maritime transport is exacerbating an already severe hunger crisis in Somalia. Rising fuel costs have pushed food prices to unsustainable levels across East Africa, where millions were already on the brink of famine before the conflict.</p>
<p>With the Strait of Hormuz \u2014 one of the world's most critical oil chokepoints \u2014 still partially disrupted by military operations, global energy markets remain in turmoil. The consequences extend far beyond the immediate war zone.</p>

<h2>Trump's Name on Airport and Presidential Library</h2>
<p>Even as courts push back on one major spending project, Trump is moving ahead with plans to put his name on a US airport and a new presidential library. The announcements have been met with mixed reactions, with supporters calling it a fitting honor and critics dismissing it as self-promotion during wartime.</p>

<h2>Oil Price Volatility Continues</h2>
<p>Global oil markets remain volatile as the Iran conflict persists. The war, which began on February 28, has now entered its sixth week, with preliminary death tolls exceeding 2,000 in Iran and dozens in Israel and Gulf states. US gasoline prices have remained elevated, with diesel surging over 40% since the conflict began.</p>

<h2>What Comes Next</h2>
<p>With the court battle over the ballroom likely to escalate, diplomatic efforts on Iran showing mixed signals, and the humanitarian crisis worsening in affected regions, the administration faces mounting pressure on multiple fronts. The next few weeks will be critical in determining whether diplomacy or escalation prevails.</p>
"""
  },
'''

with open('js/posts.js', 'r') as f:
    content = f.read()

lines = content.split('\n')
# First 4 lines are: 2 comments, empty, const posts = [
header = lines[:4]
rest = lines[4:]  # from the first { of existing content

new_content = '\n'.join(header) + '\n' + NEW_ARTICLES + '\n'.join(rest)

with open('js/posts.js', 'w') as f:
    f.write(new_content)

print(f"Inserted 2 articles. File now has {len(new_content.split(chr(10)))} lines.")
